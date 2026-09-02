import { warn } from './debug';

const detectionCache: Map<string, { language: string; confidence: number; timestamp: number }> = new Map();
const DETECTION_CACHE_TTL = 30 * 60 * 1000;

const HAN_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
const KANA_REGEX = /[\u3040-\u30FF]/;
const HANGUL_REGEX = /[\uAC00-\uD7AF\u1100-\u11FF]/;

const LANGUAGE_PATTERNS: { code: string; scripts: RegExp }[] = [
    { code: 'zh', scripts: /[\u4E00-\u9FFF\u3400-\u4DBF]/ },
    { code: 'ja', scripts: /[\u3040-\u30FF]/ },
    { code: 'ko', scripts: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
    { code: 'ar', scripts: /[\u0600-\u06FF]/ },
    { code: 'he', scripts: /[\u0590-\u05FF]/ },
    { code: 'ru', scripts: /[\u0400-\u04FF]/ },
    { code: 'th', scripts: /[\u0E00-\u0E7F]/ },
    { code: 'hi', scripts: /[\u0900-\u097F]/ },
    { code: 'el', scripts: /[\u0370-\u03FF]/ },
];

const LATIN_LANGUAGE_WORDS: { code: string; words: string[] }[] = [
    { code: 'es', words: ['el', 'la', 'los', 'las', 'que', 'de', 'en', 'un', 'una', 'es', 'no', 'por', 'con', 'para', 'como', 'pero', 'más', 'yo', 'tu', 'mi', 'muy', 'hay', 'donde', 'cuando', 'siempre', 'nunca', 'todo', 'nada', 'sin', 'sobre', 'soy', 'estoy', 'tengo', 'aquí', 'porque', 'te', 'se', 'le', 'nos', 'ya', 'del', 'al'] },
    { code: 'fr', words: ['le', 'la', 'les', 'de', 'et', 'en', 'un', 'une', 'est', 'que', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ne', 'pas', 'pour', 'avec', 'mais', 'aussi', 'très', 'mon', 'ton', 'son', 'mes', 'ses', 'sur', 'dans', 'qui', 'au', 'du', 'des', 'ce', 'cette', 'ça'] },
    { code: 'de', words: ['der', 'die', 'das', 'und', 'ist', 'ich', 'du', 'er', 'sie', 'wir', 'ihr', 'nicht', 'ein', 'eine', 'mit', 'auf', 'für', 'von', 'auch', 'noch', 'nur', 'sehr', 'wie', 'doch', 'dann', 'nein', 'ja', 'wenn', 'mein', 'dein', 'sein', 'kein'] },
    { code: 'pt', words: ['o', 'a', 'os', 'as', 'de', 'que', 'e', 'em', 'um', 'uma', 'é', 'não', 'eu', 'tu', 'ele', 'ela', 'nós', 'você', 'com', 'para', 'meu', 'seu', 'muito', 'bem', 'sim', 'aqui', 'agora', 'onde', 'quando', 'sempre', 'também', 'porque', 'mais', 'nunca', 'tudo', 'nada', 'sem'] },
    { code: 'it', words: ['il', 'la', 'lo', 'gli', 'le', 'di', 'che', 'e', 'un', 'una', 'è', 'non', 'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'con', 'per', 'anche', 'ancora', 'molto', 'bene', 'quando', 'dove', 'sempre', 'mai', 'tutto', 'mio', 'mia', 'tuo', 'suo'] },
    { code: 'nl', words: ['de', 'het', 'een', 'en', 'van', 'is', 'dat', 'op', 'te', 'in', 'voor', 'niet', 'met', 'zijn', 'maar', 'ook', 'als', 'dit'] },
    { code: 'pl', words: ['i', 'w', 'na', 'nie', 'do', 'to', 'że', 'co', 'jest', 'się', 'ja', 'ty', 'on', 'my', 'wy', 'ale', 'jak', 'tak', 'dalej', 'skąd', 'niby', 'zło', 'ból', 'nóż', 'dać', 'garść', 'nigdy', 'we', 'nikt', 'kolejny', 'raz', 'boli', 'mnie', 'wiesz', 'dosięgnie', 'moja', 'psychika', 'zabija', 'ostry', 'wezmę', 'leków', 'chciałabym', 'nic', 'czuć', 'będę', 'pod', 'gołym', 'niebem', 'gwiazd', 'mieć', 'już', 'żadnych', 'ran', 'przy', 'skończysz', 'cała', 'łzach'] },
    { code: 'lt', words: ['į', 'nėra', 'čia', 'tačiau', 'kodėl', 'todėl', 'kažkas', 'sutrikimas', 'žmogus', 'širdis', 'meilė', 'žmonės', 'gyvenimas', 'akys', 'rankos', 'namuose', 'namas', 'namai', 'namie', 'iš', 'rytoj', 'ryt', 'šiandien', 'niekada', 'visada', 'atrodo', 'kalbėti', 'nebegaliu', 'liūdna', 'liūdnas', 'skausmas', 'nebėra', 'kai', 'kaip', 'bybis', 'bybį', 'dabar', 'žodis', 'žodžiai', 'noriu'] },
    { code: 'lv', words: ['un', 'ir', 'nav', 'ja', 'kas', 'kā', 'tā', 'tas', 'šis', 'šī', 'pa', 'uz', 'ar', 'par', 'bet', 'vai', 'nē', 'jā', 'man', 'mans', 'mana', 'manā', 'tev', 'tevs', 'tavs', 'tava', 'tevi', 'mani', 'mums', 'jums', 'viņš', 'viņa', 'viņi', 'mēs', 'jūs', 'tikai', 'arī', 'vēl', 'jau', 'tagad', 'kur', 'kad', 'kāpēc', 'viss', 'visi', 'labi', 'labie', 'labs', 'esi', 'esmu', 'būt', 'būs', 'biju', 'sirds', 'mīlu', 'dzīve', 'nees', 'čoms', 'pusē'] },
    { code: 'sv', words: ['och', 'att', 'det', 'som', 'den', 'är', 'av', 'för', 'med', 'till', 'har', 'inte', 'om', 'ett', 'men', 'jag', 'du', 'ni', 'vi', 'han', 'hon', 'var', 'sig', 'från', 'när', 'efter', 'kan', 'ska', 'skulle', 'än', 'här', 'där', 'nu', 'så', 'vad', 'vem', 'hur', 'varför', 'mig', 'dig', 'din', 'ditt', 'min', 'mitt', 'oss', 'dem', 'aldrig', 'alltid', 'bara', 'hela', 'igen', 'ingen', 'inget', 'inga', 'ingenting', 'något', 'någon', 'alla', 'allt', 'vill', 'ville', 'kommer', 'kom', 'gick', 'blir', 'blev', 'säger', 'vet', 'tror', 'känner', 'saknar', 'hem', 'över', 'under', 'mot', 'utan', 'genom', 'eller', 'också', 'ändå', 'kanske', 'hjärta', 'hjärtat', 'kärlek', 'natt', 'natten', 'dag', 'dagen', 'liv', 'livet', 'värld', 'världen', 'tid', 'tiden', 'ögon', 'ögonen', 'ser', 'går', 'får', 'gör', 'står', 'håller', 'sedan', 'bort', 'borta', 'tillbaka', 'tyst'] },
    { code: 'da', words: ['og', 'det', 'til', 'som', 'på', 'de', 'med', 'af', 'ikke', 'der', 'var', 'mig', 'men', 'har', 'om', 'vi', 'min', 'mit', 'havde', 'ham', 'hun', 'nu', 'da', 'fra', 'du', 'ud', 'sig', 'når', 'været', 'hvor', 'hvad', 'hvem', 'hvorfor', 'jeg', 'dig', 'kan', 'skal', 'ved', 'hjerte', 'hjertet', 'kærlighed', 'aldrig', 'altid', 'bare', 'noget', 'nogen', 'ingen', 'igen', 'øjne', 'nat', 'natten', 'liv', 'livet', 'verden', 'tid', 'tiden', 'alt', 'alle', 'meget', 'sådan', 'tilbage', 'hjem', 'selv', 'dem', 'jer', 'deres', 'denne', 'dette', 'sammen', 'kun', 'også', 'eller', 'uden', 'gennem', 'over', 'under', 'mod', 'siger', 'kommer', 'blev', 'bliver'] },
    { code: 'no', words: ['og', 'det', 'den', 'til', 'som', 'på', 'de', 'med', 'av', 'ikke', 'ikkje', 'der', 'så', 'var', 'meg', 'seg', 'men', 'har', 'om', 'vi', 'min', 'mitt', 'hadde', 'hun', 'nå', 'over', 'da', 'ved', 'fra', 'du', 'ut', 'dem', 'oss', 'opp', 'når', 'hvor', 'hvem', 'hva', 'hvorfor', 'jeg', 'deg', 'skal', 'kan', 'vil', 'ville', 'kommer', 'kom', 'gikk', 'blir', 'ble', 'sier', 'vet', 'tror', 'hjerte', 'hjertet', 'kjærlighet', 'aldri', 'alltid', 'bare', 'noe', 'noen', 'ingen', 'ingenting', 'igjen', 'øyne', 'natt', 'natten', 'liv', 'livet', 'verden', 'tid', 'tiden', 'alt', 'alle', 'mye', 'slik', 'tilbake', 'hjem', 'selv', 'deres', 'denne', 'dette', 'sammen', 'også', 'eller', 'uten', 'gjennom', 'under', 'mot', 'borte', 'stille'] },
    { code: 'fi', words: ['että', 'mutta', 'kun', 'niin', 'vain', 'myös', 'vielä', 'nyt', 'sitten', 'tässä', 'siellä', 'täällä', 'missä', 'mitä', 'miksi', 'kuinka', 'kuka', 'minä', 'sinä', 'hän', 'me', 'te', 'he', 'olen', 'olet', 'olemme', 'ovat', 'oli', 'ollut', 'olla', 'sydän', 'sydämen', 'rakkaus', 'rakastan', 'yö', 'yön', 'yössä', 'päivä', 'päivän', 'elämä', 'elämän', 'maailma', 'maailman', 'aika', 'ajan', 'silmät', 'silmien', 'kaikki', 'kaiken', 'mitään', 'kukaan', 'ilman', 'kanssa', 'kautta', 'takaisin', 'koti', 'kotiin', 'tule', 'tulee', 'menee', 'sanoi', 'tiedän', 'uskon', 'muista', 'muistan', 'enää', 'aina', 'koskaan', 'jälkeen', 'yksin', 'pois'] },
    { code: 'hi', words: ['hai', 'hain', 'hoon', 'tha', 'thi', 'nahi', 'nahin', 'kya', 'kaise', 'kaisa', 'kaisi', 'kahan', 'kyun', 'kab', 'mera', 'meri', 'tera', 'teri', 'tere', 'tumhara', 'hamara', 'apna', 'apni', 'apne', 'tujhe', 'mujhe', 'mujhko', 'tujhko', 'tumhe', 'hume', 'unhe', 'isko', 'usko', 'uski', 'iski', 'iske', 'uske', 'dil', 'pyar', 'ishq', 'mohabbat', 'zindagi', 'duniya', 'sapna', 'sapne', 'raat', 'din', 'aankh', 'aankhein', 'ankhiyo', 'nazar', 'waqt', 'gham', 'khushi', 'dard', 'rang', 'dhoop', 'chand', 'sitara', 'dekho', 'dekh', 'dekhna', 'suno', 'sun', 'sunna', 'bolo', 'bol', 'bolna', 'chalo', 'chal', 'chalna', 'jao', 'jana', 'aao', 'aaja', 'aana', 'karo', 'karna', 'milna', 'mila', 'milo', 'ruk', 'ruko', 'rukna', 'jeena', 'jee', 'nach', 'nachle', 'gaana', 'gana', 'bajao', 'baja', 'dikha', 'dikhao', 'dikhaa', 'parda', 'nakhre', 'mein', 'pe', 'par', 'wala', 'wali', 'wale', 'bhi', 'aur', 'lekin', 'magar', 'phir', 'abhi', 'kabhi', 'hamesha', 'humesha', 'sirf', 'bas', 'bahut', 'bohot', 'zyada', 'kuch', 'sab', 'koi', 'kaun', 'yahan', 'wahan', 'udhar', 'idhar', 'accha', 'acha', 'theek', 'bilkul', 'zaroor', 'sach', 'jhooth', 'alag', 'saath', 'mann', 'mehboob', 'dilbar', 'sanam', 'jannat', 'husn', 'jaane', 'jaana', 'toh', 'se', 'ke', 'ka', 'ki', 'ko', 'ne', 'tu', 'hum', 'tum', 'main', 'yeh', 'woh', 'ab', 'jab', 'tab', 'agar', 'mat', 'ya'] },
    { code: 'en', words: ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'his', 'her', 'our', 'their', 'do', 'did', 'not', 'no', 'have', 'has', 'had', 'be', 'been', 'will', 'would', 'can', 'could', 'just', 'like', 'so', 'this', 'that', 'what', 'when', 'how', 'all', 'if', 'there', 'them', 'from', 'about', 'up', 'out', 'know', 'only', 'into', 'than', 'then', 'its', 'who', 'which', 'more', 'some', 'these', 'those', 'here'] },
];

const LATIN_LANGUAGE_WORD_SETS: { code: string; words: Set<string> }[] = LATIN_LANGUAGE_WORDS.map(lang => ({
    code: lang.code,
    words: new Set(lang.words)
}));

const HAN_VARIANT_PAIRS = [
    '爱愛', '说說', '继繼', '续續', '们們', '这這', '时時', '国國', '学學', '会會', '来來', '对對',
    '个個', '现現', '长長', '问問', '见見', '开開', '关關', '门門', '无無', '为為', '还還', '过過',
    '从從', '让讓', '请請', '谁誰', '话話', '语語', '谢謝', '该該', '记記', '认認', '识識', '讲講',
    '论論', '试試', '诉訴', '词詞', '读讀', '课課', '谈談', '许許', '议議', '变變', '电電', '车車',
    '东東', '马馬', '鸟鳥', '鱼魚', '龙龍', '头頭', '买買', '卖賣', '万萬', '与與', '业業', '丽麗',
    '举舉', '义義', '乐樂', '习習', '书書', '亲親', '产產', '众眾', '优優', '传傳', '伤傷', '体體',
    '价價', '儿兒', '党黨', '内內', '军軍', '农農', '决決', '净淨', '减減', '凤鳳', '处處', '备備',
    '够夠', '复復', '实實', '宁寧', '宝寶', '寻尋', '导導', '岁歲', '归歸', '当當', '尽盡', '层層',
    '属屬', '岛島', '师師', '带帶', '帮幫', '广廣', '应應', '庆慶', '张張', '录錄', '彻徹', '径徑',
    '忆憶', '忧憂', '怀懷', '态態', '总總', '恋戀', '惊驚', '惧懼', '惯慣', '战戰', '户戶', '扫掃',
    '执執', '扩擴', '扬揚', '择擇', '报報', '担擔', '拟擬', '挂掛', '挥揮', '换換', '据據', '损損',
    '摆擺', '摄攝', '权權', '杀殺', '条條', '极極', '构構', '枪槍', '标標', '树樹', '样樣', '检檢',
    '楼樓', '欢歡', '欧歐', '气氣', '汉漢', '汤湯', '沟溝', '没沒', '泪淚', '洁潔', '测測', '济濟',
    '浏瀏', '涌湧', '润潤', '涨漲', '渐漸', '温溫', '湾灣', '满滿', '滨濱', '滤濾', '滚滾', '灭滅',
    '灯燈', '灵靈', '灾災', '烦煩', '热熱', '爷爺', '牵牽', '犹猶', '独獨', '狮獅', '猪豬', '献獻',
    '玛瑪', '环環', '琼瓊', '疗療', '疯瘋', '皱皺', '盘盤', '睁睜', '瞒瞞', '码碼', '确確', '础礎',
    '礼禮', '祸禍', '离離', '种種', '积積', '称稱', '稳穩', '穷窮', '竞競', '笔筆', '简簡', '类類',
    '粮糧', '紧緊', '纪紀', '纯純', '纲綱', '纳納', '纸紙', '级級', '纷紛', '线線', '组組', '细細',
    '织織', '终終', '经經', '结結', '绕繞', '给給', '络絡', '绝絕', '统統', '绩績', '绪緒', '绿綠',
    '缓緩', '编編', '缘緣', '缩縮', '网網', '罗羅', '罚罰', '聪聰', '联聯', '声聲', '肠腸', '肤膚',
    '胜勝', '脑腦', '脸臉', '腊臘', '舰艦', '艰艱', '节節', '芦蘆', '苏蘇', '药藥', '荣榮', '莱萊',
    '获獲', '营營', '萧蕭', '蓝藍', '虑慮', '虽雖', '蚀蝕', '蜡蠟', '补補', '装裝', '观觀', '觉覺',
    '触觸', '计計', '订訂', '讨討', '训訓', '讯訊', '设設', '访訪', '证證', '评評', '译譯', '诗詩',
    '诚誠', '询詢', '详詳', '误誤', '诸諸', '调調', '谊誼', '谋謀', '谎謊', '谣謠', '谱譜', '贝貝',
    '负負', '贞貞', '财財', '责責', '贤賢', '败敗', '货貨', '质質', '贩販', '贪貪', '贫貧', '购購',
    '贯貫', '贱賤', '贴貼', '贵貴', '贸貿', '费費', '贺賀', '赋賦', '赌賭', '赏賞', '赐賜', '赔賠',
    '赛賽', '赠贈', '赢贏', '赵趙', '趋趨', '跃躍', '践踐', '轨軌', '转轉', '轮輪', '软軟', '轻輕',
    '载載', '较較', '辅輔', '辆輛', '辈輩', '辉輝', '输輸', '辞辭', '边邊', '达達', '迁遷', '运運',
    '进進', '远遠', '违違', '连連', '迟遲', '适適', '选選', '逊遜', '递遞', '逻邏', '遗遺', '邓鄧',
    '郑鄭', '邮郵', '酱醬', '释釋', '钟鐘', '钢鋼', '钱錢', '铁鐵', '铃鈴', '银銀', '锁鎖', '锅鍋',
    '错錯', '锦錦', '键鍵', '镜鏡', '闪閃', '闭閉', '闯闖', '间間', '闷悶', '闹鬧', '闻聞', '阅閱',
    '阔闊', '队隊', '阶階', '阳陽', '阴陰', '陆陸', '陈陳', '险險', '随隨', '隐隱', '难難', '雾霧',
    '静靜', '韩韓', '页頁', '顶頂', '项項', '顺順', '须須', '顾顧', '顿頓', '预預', '领領', '颜顏',
    '颗顆', '题題', '颤顫', '风風', '飘飄', '飞飛', '饭飯', '饮飲', '饰飾', '饱飽', '饿餓', '馆館',
    '驱驅', '驶駛', '驾駕', '验驗', '骗騙', '骄驕', '髅髏', '鲜鮮', '鸡雞', '鸣鳴', '鸿鴻', '鹅鵝',
    '鹰鷹', '麦麥', '黄黃', '齐齊', '齿齒', '龄齡', '龟龜', '发發'
];

const SIMPLIFIED_ONLY_CHARS = new Set(HAN_VARIANT_PAIRS.map(pair => pair[0]));
const TRADITIONAL_ONLY_CHARS = new Set(HAN_VARIANT_PAIRS.map(pair => pair[1]));

export const CHINESE_SIMPLIFIED = 'zh-Hans';
export const CHINESE_TRADITIONAL = 'zh-Hant';
export const CHINESE_UNDETERMINED = 'zh-Hani';

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
    'chinese (simplified)': 'zh-hans',
    'chinese (traditional)': 'zh-hant',
    'chinese simplified': 'zh-hans',
    'chinese traditional': 'zh-hant',
    'simplified chinese': 'zh-hans',
    'traditional chinese': 'zh-hant',
    english: 'en',
    spanish: 'es',
    french: 'fr',
    german: 'de',
    italian: 'it',
    portuguese: 'pt',
    dutch: 'nl',
    polish: 'pl',
    lithuanian: 'lt',
    latvian: 'lv',
    swedish: 'sv',
    danish: 'da',
    norwegian: 'no',
    'norwegian bokmal': 'no',
    'norwegian nynorsk': 'no',
    finnish: 'fi',
    turkish: 'tr',
    japanese: 'ja',
    chinese: 'zh',
    korean: 'ko',
    arabic: 'ar',
    hebrew: 'he',
    russian: 'ru',
    thai: 'th',
    hindi: 'hi',
    greek: 'el'
};

const ENGLISH_EQUIVALENT_CODES = new Set(['pcm', 'sco', 'jam', 'cpe']);

const NORWEGIAN_EQUIVALENT_CODES = new Set(['nb', 'nn', 'nob', 'nno']);

const CHINESE_SUBTAG_TO_VARIANT: Record<string, string> = {
    hans: 'zh-hans',
    chs: 'zh-hans',
    cn: 'zh-hans',
    sg: 'zh-hans',
    hant: 'zh-hant',
    cht: 'zh-hant',
    tw: 'zh-hant',
    hk: 'zh-hant',
    mo: 'zh-hant',
    hani: 'zh-hani'
};

function normalizeChineseCode(subtags: string[]): string {
    for (const subtag of subtags) {
        const variant = CHINESE_SUBTAG_TO_VARIANT[subtag];
        if (variant) return variant;
    }
    return 'zh-hani';
}

export function normalizeLanguageCode(code?: string | null): string {
    if (!code) return 'unknown';
    const value = code.trim().toLowerCase();
    if (!value || value === 'unknown' || value === 'auto') return value || 'unknown';

    const nameKey = value
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (LANGUAGE_NAME_TO_CODE[value]) return LANGUAGE_NAME_TO_CODE[value];
    if (LANGUAGE_NAME_TO_CODE[nameKey]) return LANGUAGE_NAME_TO_CODE[nameKey];

    const subtags = value.replace(/_/g, '-').split('-');
    const base = subtags[0];
    if (base === 'zh' || base === 'cmn' || base === 'yue') return normalizeChineseCode(subtags.slice(1));
    if (ENGLISH_EQUIVALENT_CODES.has(base)) return 'en';
    if (NORWEGIAN_EQUIVALENT_CODES.has(base)) return 'no';
    return base;
}

export function normalizeTargetLanguageCode(code?: string | null): string {
    const normalized = normalizeLanguageCode(code);
    return normalized === 'zh-hani' ? 'zh-hans' : normalized;
}

export function detectChineseScript(text: string): string {
    let simplified = 0;
    let traditional = 0;

    for (const char of text || '') {
        if (SIMPLIFIED_ONLY_CHARS.has(char)) simplified++;
        else if (TRADITIONAL_ONLY_CHARS.has(char)) traditional++;
    }

    if (simplified === 0 && traditional === 0) return CHINESE_UNDETERMINED;
    return traditional >= simplified ? CHINESE_TRADITIONAL : CHINESE_SIMPLIFIED;
}

export function refineChineseLanguageCode(code: string | undefined, lines: string[]): string | undefined {
    if (!code || normalizeLanguageCode(code) !== 'zh-hani') return code;
    return detectChineseScript(lines.join('\n'));
}

function getSampleIndices(length: number): number[] {
    if (length <= 0) return [];

    const indices = new Set<number>();

    for (let i = 0; i < Math.min(5, length); i++) {
        indices.add(i);
    }

    const middle = Math.floor(length / 2);
    for (let i = middle - 2; i <= middle + 2; i++) {
        if (i >= 0 && i < length) {
            indices.add(i);
        }
    }

    for (let i = Math.max(0, length - 5); i < length; i++) {
        indices.add(i);
    }

    return [...indices].sort((a, b) => a - b);
}

function buildSampleText(lines: string[]): string {
    const indices = getSampleIndices(lines.length);
    return indices
        .map(i => lines[i])
        .filter(line => line && line.trim().length > 0 && !/^[•♪♫\s\-–—]+$/.test(line.trim()))
        .join(' ');
}

function tokenizeWords(text: string): string[] {
    const normalized = text.replace(/[’ʼ‘`´]/g, "'");
    const matches = normalized.toLowerCase().match(/[\p{L}']+/gu);
    if (!matches) return [];
    return matches.filter(word => word.length > 1);
}

const ELISION_PREFIX_TO_WORD: Record<string, string> = {
    j: 'je',
    l: 'le',
    d: 'de',
    m: 'me',
    t: 'te',
    s: 'se',
    n: 'ne',
    c: 'ce',
    qu: 'que',
    jusqu: 'jusque',
    puisqu: 'puisque',
    lorsqu: 'lorsque',
    quoiqu: 'quoique'
};

function expandElidedWords(words: string[]): string[] {
    const expanded: string[] = [];
    for (const word of words) {
        expanded.push(word);
        const apostropheIndex = word.indexOf("'");
        if (apostropheIndex <= 0) continue;
        const prefix = word.slice(0, apostropheIndex);
        const rest = word.slice(apostropheIndex + 1);
        const mapped = ELISION_PREFIX_TO_WORD[prefix];
        if (mapped) expanded.push(mapped);
        if (rest.length > 1) expanded.push(rest);
    }
    return expanded;
}

const NON_LATIN_SCRIPT_DETECTION_REGEX = /[぀-ヿ一-鿿가-힯؀-ۿ֐-׿Ѐ-ӿ฀-๿ऀ-ॿͰ-Ͽ]/;

const JA_ROMAJI_STRONG_TOKENS = new Set([
    'desu', 'masu', 'mashita', 'deshita', 'darou', 'daro', 'desho', 'deshou',
    'kimi', 'boku', 'watashi', 'anata', 'kokoro', 'sayonara', 'sayounara',
    'arigatou', 'arigato', 'konnichiwa', 'ohayou', 'yoru', 'asa', 'tsuki',
    'sora', 'hoshi', 'namida', 'yume', 'koi', 'aishiteru', 'suki',
    'tsuzuku', 'tsuyoi', 'tsumetai', 'shiawase', 'chigau', 'chiisai',
    'hajimete', 'mou', 'demo', 'sou', 'naku',
    'datta', 'janai', 'iru', 'naru', 'suru', 'shita', 'shite',
    'iku', 'itta', 'kuru', 'kita', 'omou', 'omotta',
]);

const JA_ROMAJI_PARTICLE_TOKENS = new Set([
    'wa', 'wo', 'no', 'ni', 'ga', 'to', 'de', 'mo', 'ya', 'ka', 'ne', 'yo',
    'da', 'nai', 'aru',
]);

const ROMAJI_SYLLABLE_REGEX = /^(?:[kgsztdnhbpmrw]?y?[aeiou]{1,2}|tsu|shi|chi|n)+n?$/i;

function countRomajiTokens(words: string[]): { romaji: number; specific: number; strong: number } {
    let romaji = 0;
    let specific = 0;
    let strong = 0;
    for (const word of words) {
        if (JA_ROMAJI_STRONG_TOKENS.has(word)) {
            strong++;
            specific++;
            romaji++;
            continue;
        }
        if (JA_ROMAJI_PARTICLE_TOKENS.has(word)) {
            specific++;
            romaji++;
            continue;
        }
        if (word.length >= 2 && ROMAJI_SYLLABLE_REGEX.test(word)) {
            romaji++;
        }
    }
    return { romaji, specific, strong };
}

export function detectRomanizedJapanese(text: string): { confidence: number; ratio: number; specificHits: number } | null {
    if (!text) return null;
    if (NON_LATIN_SCRIPT_DETECTION_REGEX.test(text)) return null;
    const words = tokenizeWords(text);
    if (words.length < 4) return null;
    const { romaji, specific, strong } = countRomajiTokens(words);
    const ratio = romaji / words.length;
    if (strong < 1) return null;
    if (ratio < 0.4) return null;
    if (countLanguageWordHits(expandElidedWords(words), 'en') >= 2) return null;
    return {
        confidence: Math.min(0.9, 0.5 + ratio * 0.4 + Math.min(specific, 4) * 0.05),
        ratio,
        specificHits: specific,
    };
}

export function scanCorpusForCjk(
    lines: string[]
): { code: string; confidence: number; kana: number; kanji: number; hangul: number } | null {
    let kana = 0;
    let kanji = 0;
    let hangul = 0;
    for (const line of lines) {
        if (!line) continue;
        const k = line.match(/[\u3040-\u30FF]/g);
        if (k) kana += k.length;
        const h = line.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g);
        if (h) kanji += h.length;
        const ha = line.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g);
        if (ha) hangul += ha.length;
    }
    if (kana >= 4 || (kana >= 1 && kanji >= 6)) {
        return { code: 'ja', confidence: 0.92, kana, kanji, hangul };
    }
    if (hangul >= 4) {
        return { code: 'ko', confidence: 0.92, kana, kanji, hangul };
    }
    if (kanji >= 8 && kana === 0) {
        return { code: detectChineseScript(lines.join('\n')), confidence: 0.9, kana, kanji, hangul };
    }
    return null;
}

const DISTINCTIVE_LATIN_MARKERS: { code: string; chars: string }[] = [
    { code: 'pl', chars: 'łżźśń' },
    { code: 'cs', chars: 'řěů' },
    { code: 'lt', chars: 'ėįų' },
    { code: 'lv', chars: 'āēīģķļņ' },
    { code: 'hr', chars: 'đ' },
];

const DISTINCTIVE_MARKER_SETS: { code: string; chars: Set<string> }[] = DISTINCTIVE_LATIN_MARKERS.map(entry => ({
    code: entry.code,
    chars: new Set(entry.chars.split(''))
}));

const VIETNAMESE_MARKER_REGEX = /[ơướờởỡợứừửữự]/i;

export function detectByDistinctiveLatinMarkers(text: string): { code: string; confidence: number } | null {
    if (!text) return null;
    if (VIETNAMESE_MARKER_REGEX.test(text)) return null;

    const lower = text.toLowerCase();
    const counts: Record<string, number> = {};

    for (const char of lower) {
        for (const marker of DISTINCTIVE_MARKER_SETS) {
            if (marker.chars.has(char)) {
                counts[marker.code] = (counts[marker.code] || 0) + 1;
            }
        }
    }

    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (ranked.length === 0) return null;

    const [topCode, topCount] = ranked[0];
    const runnerUp = ranked[1]?.[1] ?? 0;

    if (topCount < 2 && !(topCount === 1 && runnerUp === 0)) return null;
    if (topCount <= runnerUp) return null;

    const confidence = Math.min(0.9, 0.78 + Math.min(topCount, 6) * 0.02);
    return { code: topCode, confidence };
}

export function detectLanguageHeuristic(text: string): { code: string; confidence: number } | null {
    if (!text) return null;

    const hasNonLatinScript = NON_LATIN_SCRIPT_DETECTION_REGEX.test(text);
    const minLength = hasNonLatinScript ? 1 : 10;
    if (text.length < minLength) {
        return null;
    }

    const distinctive = detectByDistinctiveLatinMarkers(text);
    if (distinctive) {
        return distinctive;
    }

    const normalizedText = text.trim();

    let totalChars = 0;
    const scriptCounts: { [code: string]: number } = {};

    for (const char of normalizedText) {
        if (/\s/.test(char)) continue;
        totalChars++;

        for (const lang of LANGUAGE_PATTERNS) {
            if (lang.scripts.test(char)) {
                scriptCounts[lang.code] = (scriptCounts[lang.code] || 0) + 1;
            }
        }
    }

    if (totalChars === 0) return null;

    const hanCount = (normalizedText.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g) || []).length;
    const kanaCount = (normalizedText.match(/[\u3040-\u30FF]/g) || []).length;
    const hangulCount = (normalizedText.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length;

    if (kanaCount > 0 && (hanCount + kanaCount) / totalChars > 0.2) {
        return { code: 'ja', confidence: Math.min(0.95, 0.7 + (hanCount + kanaCount) / totalChars * 0.25) };
    }

    if (hangulCount > 0 && hangulCount / totalChars > 0.2) {
        return { code: 'ko', confidence: Math.min(0.95, 0.65 + hangulCount / totalChars * 0.3) };
    }

    if (hanCount > 0 && hanCount / totalChars > 0.2) {
        return { code: detectChineseScript(normalizedText), confidence: Math.min(0.95, 0.65 + hanCount / totalChars * 0.3) };
    }

    const dominantScript = Object.entries(scriptCounts)
        .filter(([code]) => code !== 'zh' && code !== 'ja' && code !== 'ko')
        .map(([code, count]) => ({ code, count, ratio: count / totalChars }))
        .sort((a, b) => b.count - a.count)[0];

    if (dominantScript && dominantScript.ratio > 0.2) {
        return {
            code: dominantScript.code,
            confidence: Math.min(0.95, 0.6 + dominantScript.ratio * 0.3)
        };
    }

    const words = tokenizeWords(normalizedText);
    if (words.length < 3) {
        return null;
    }

    const matchWords = expandElidedWords(words);

    const wordCounts: { [code: string]: number } = {};
    let maxCount = 0;
    let maxLang = 'en';

    for (const lang of LATIN_LANGUAGE_WORD_SETS) {
        let count = 0;
        for (const word of matchWords) {
            if (lang.words.has(word)) {
                count++;
            }
        }
        wordCounts[lang.code] = count;

        if (count > maxCount) {
            maxCount = count;
            maxLang = lang.code;
        }
    }

    const matchRatio = maxCount / words.length;

    const minMatchCount = words.length <= 6 ? 2 : 3;
    if (matchRatio > 0.12 && maxCount >= minMatchCount) {
        const sortedCounts = Object.entries(wordCounts)
            .sort((a, b) => b[1] - a[1]);

        if (sortedCounts.length < 2 || sortedCounts[1][1] === 0) {
            return { code: maxLang, confidence: Math.min(0.75, 0.35 + matchRatio) };
        }

        const disambiguationRatio = words.length <= 6 ? 1.3 : 1.5;
        if (sortedCounts[0][1] >= sortedCounts[1][1] * disambiguationRatio) {
            return { code: maxLang, confidence: Math.min(0.8, 0.4 + matchRatio) };
        }
    }

    return null;
}

async function detectLanguageViaAPI(text: string): Promise<{ code: string; confidence: number }> {
    const sample = text.slice(0, 500);
    const params = new URLSearchParams({
        client: 'gtx',
        sl: 'auto',
        tl: 'en',
        dt: 't',
        q: sample
    });

    const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Language detection API error: ${response.status}`);
    }

    const data = await response.json();
    const rawDetectedLang = typeof data?.[2] === 'string' ? data[2] : 'unknown';
    let detectedLang = rawDetectedLang === 'unknown' ? 'unknown' : normalizeLanguageCode(rawDetectedLang);
    if (detectedLang.startsWith('zh-')) {
        const scriptVariant = detectChineseScript(sample);
        if (scriptVariant !== CHINESE_UNDETERMINED) {
            detectedLang = scriptVariant;
        }
    }
    const confidence = detectedLang !== 'unknown' ? 0.9 : 0.5;

    return { code: detectedLang, confidence };
}

export async function detectLyricsLanguage(
    lyrics: string[],
    trackUri?: string
): Promise<{ code: string; confidence: number }> {
    if (trackUri) {
        const cached = detectionCache.get(trackUri);
        if (cached && Date.now() - cached.timestamp < DETECTION_CACHE_TTL) {
            return { code: cached.language, confidence: cached.confidence };
        }
    }

    const corpusScan = scanCorpusForCjk(lyrics);
    if (corpusScan) {
        if (trackUri) {
            detectionCache.set(trackUri, {
                language: corpusScan.code,
                confidence: corpusScan.confidence,
                timestamp: Date.now()
            });
        }
        return { code: corpusScan.code, confidence: corpusScan.confidence };
    }

    const sampleText = buildSampleText(lyrics);

    if (sampleText.length < 20) {
        return { code: 'unknown', confidence: 0 };
    }

    const heuristic = detectLanguageHeuristic(sampleText);

    if (heuristic && heuristic.code === 'en') {
        const romaji = detectRomanizedJapanese(sampleText);
        if (romaji) {
            const result = { code: 'ja', confidence: romaji.confidence };
            if (trackUri) {
                detectionCache.set(trackUri, {
                    language: result.code,
                    confidence: result.confidence,
                    timestamp: Date.now()
                });
            }
            return result;
        }
    }

    if (heuristic && heuristic.confidence >= 0.7) {
        if (trackUri) {
            detectionCache.set(trackUri, {
                language: heuristic.code,
                confidence: heuristic.confidence,
                timestamp: Date.now()
            });
        }

        return heuristic;
    }

    try {
        const apiResult = await detectLanguageViaAPI(sampleText);
        if (trackUri) {
            detectionCache.set(trackUri, {
                language: apiResult.code,
                confidence: apiResult.confidence,
                timestamp: Date.now()
            });
        }

        return apiResult;
    } catch (error) {
        warn('API language detection failed:', error);
        return heuristic || { code: 'unknown', confidence: 0 };
    }
}

function countLanguageWordHits(words: string[], code: string): number {
    const entry = LATIN_LANGUAGE_WORD_SETS.find(lang => lang.code === code);
    if (!entry) return 0;

    let count = 0;
    for (const word of new Set(words)) {
        if (entry.words.has(word)) count++;
    }
    return count;
}

export function isLikelyNonTargetLine(text: string, targetLanguage: string): boolean {
    const trimmed = (text || '').trim();
    if (!trimmed) return false;

    if (NON_LATIN_SCRIPT_DETECTION_REGEX.test(trimmed)) {
        return !['ja', 'zh-hans', 'zh-hant', 'zh-hani', 'ko', 'ar', 'he', 'ru', 'th', 'hi', 'el']
            .includes(normalizeTargetLanguageCode(targetLanguage));
    }

    const targetCode = normalizeTargetLanguageCode(targetLanguage);
    if (!LATIN_LANGUAGE_WORD_SETS.some(lang => lang.code === targetCode)) return false;

    const words = expandElidedWords(tokenizeWords(trimmed));
    if (words.length < 3) return false;
    if (new Set(words).size < 3) return false;
    if (!words.some(word => word.length >= 4)) return false;
    if (countLanguageWordHits(words, targetCode) > 0) return false;

    return LATIN_LANGUAGE_WORD_SETS.some(lang => lang.code !== targetCode && countLanguageWordHits(words, lang.code) >= 2);
}

export function isSameLanguage(source: string, target: string): boolean {
    if (!source || source === 'unknown') return false;

    const normalizedSource = normalizeLanguageCode(source);
    const normalizedTarget = normalizeTargetLanguageCode(target);

    if (normalizedSource === normalizedTarget) return true;

    return normalizedSource === 'zh-hani' && normalizedTarget.startsWith('zh-');
}

export function assessMixedLanguageContent(
    lines: string[],
    targetLanguage: string
): { hasMixedContent: boolean; nonTargetCount: number; uncertainCount: number } {
    let nonTargetCount = 0;
    let nonLatinNonTargetCount = 0;
    let uncertainCount = 0;
    let targetCount = 0;
    const targetBase = targetLanguage.toLowerCase().split('-')[0].split('_')[0];
    const targetIsLatin = !['ja', 'zh', 'ko', 'ar', 'he', 'ru', 'th', 'hi', 'el'].includes(targetBase);

    for (const line of lines) {
        const trimmed = (line || '').trim();
        if (!trimmed || /^[•♪♫\s\-–—]+$/.test(trimmed)) continue;

        const hasNonLatin = NON_LATIN_SCRIPT_DETECTION_REGEX.test(trimmed);

        if (!hasNonLatin && trimmed.length < 3) continue;

        if (targetIsLatin && hasNonLatin) {
            nonTargetCount++;
            nonLatinNonTargetCount++;
            continue;
        }

        if (targetIsLatin && !hasNonLatin && targetBase !== 'ja') {
            const romaji = detectRomanizedJapanese(trimmed);
            if (romaji && !isSameLanguage('ja', targetLanguage)) {
                nonTargetCount++;
                continue;
            }
        }

        const detected = detectLanguageHeuristic(trimmed);

        if (!detected) {
            if (isLikelyNonTargetLine(trimmed, targetLanguage)) {
                nonTargetCount++;
            } else if (trimmed.length >= 10) {
                uncertainCount++;
            }
            continue;
        }

        if (isSameLanguage(detected.code, targetLanguage)) {
            targetCount++;
        } else if (detected.confidence >= 0.6) {
            nonTargetCount++;
        } else {
            uncertainCount++;
        }
    }

    const totalChecked = targetCount + nonTargetCount + uncertainCount;
    if (totalChecked === 0) return { hasMixedContent: false, nonTargetCount: 0, uncertainCount: 0 };

    const uncertainRatio = uncertainCount / totalChecked;
    const hasMixedContent = nonLatinNonTargetCount > 0 ||
        nonTargetCount >= 1 ||
        (uncertainCount > 0 && uncertainRatio > 0.35 && nonTargetCount > 0);

    return { hasMixedContent, nonTargetCount, uncertainCount };
}

export async function shouldSkipTranslation(
    lyrics: string[],
    targetLanguage: string,
    trackUri?: string
): Promise<{ skip: boolean; reason?: string; detectedLanguage?: string }> {
    const nonEmptyLyrics = lyrics.filter(l => l && l.trim().length > 0 && !/^[•♪♫\s\-–—]+$/.test(l.trim()));
    if (nonEmptyLyrics.length === 0) {
        return { skip: false };
    }

    const corpusScan = scanCorpusForCjk(nonEmptyLyrics);
    if (corpusScan) {
        if (isSameLanguage(corpusScan.code, targetLanguage)) {
            const mixedCheck = assessMixedLanguageContent(nonEmptyLyrics, targetLanguage);
            if (mixedCheck.hasMixedContent) {
                return { skip: false, detectedLanguage: corpusScan.code };
            }
            return {
                skip: true,
                reason: `Lyrics already in ${corpusScan.code.toUpperCase()}`,
                detectedLanguage: corpusScan.code
            };
        }
        return { skip: false, detectedLanguage: corpusScan.code };
    }

    const sampleText = buildSampleText(nonEmptyLyrics);
    let quickHeuristic = detectLanguageHeuristic(sampleText);

    if (quickHeuristic && quickHeuristic.code === 'en') {
        const romaji = detectRomanizedJapanese(sampleText);
        if (romaji) {
            quickHeuristic = { code: 'ja', confidence: romaji.confidence };
        }
    }

    if (quickHeuristic && quickHeuristic.confidence >= (isSameLanguage(quickHeuristic.code, targetLanguage) ? 0.65 : 0.8)) {
        if (isSameLanguage(quickHeuristic.code, targetLanguage)) {
            const mixedCheck = assessMixedLanguageContent(nonEmptyLyrics, targetLanguage);
            if (mixedCheck.hasMixedContent) {
                return { skip: false, detectedLanguage: quickHeuristic.code };
            }
            return {
                skip: true,
                reason: `Lyrics already in ${quickHeuristic.code.toUpperCase()}`,
                detectedLanguage: quickHeuristic.code
            };
        }
        return { skip: false, detectedLanguage: quickHeuristic.code };
    }

    const detection = await detectLyricsLanguage(lyrics, trackUri);

    if (detection.code === 'unknown' || detection.confidence < 0.6) {
        return { skip: false };
    }

    if (isSameLanguage(detection.code, targetLanguage)) {
        const mixedCheck = assessMixedLanguageContent(nonEmptyLyrics, targetLanguage);
        if (mixedCheck.hasMixedContent) {
            return { skip: false, detectedLanguage: detection.code };
        }
        return {
            skip: true,
            reason: `Lyrics already in ${detection.code.toUpperCase()}`,
            detectedLanguage: detection.code
        };
    }

    return {
        skip: false,
        detectedLanguage: detection.code
    };
}

export function clearDetectionCache(): void {
    detectionCache.clear();
}

export function getLanguageName(code: string): string {
    const languageNames: { [key: string]: string } = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'nl': 'Dutch',
        'pl': 'Polish',
        'lt': 'Lithuanian',
        'ru': 'Russian',
        'ja': 'Japanese',
        'zh': 'Chinese',
        'zh-hans': 'Chinese (Simplified)',
        'zh-hant': 'Chinese (Traditional)',
        'zh-hani': 'Chinese',
        'ko': 'Korean',
        'ar': 'Arabic',
        'he': 'Hebrew',
        'hi': 'Hindi',
        'th': 'Thai',
        'el': 'Greek',
        'tr': 'Turkish',
        'vi': 'Vietnamese',
        'id': 'Indonesian',
        'ms': 'Malay',
        'tl': 'Tagalog',
        'sv': 'Swedish',
        'no': 'Norwegian',
        'da': 'Danish',
        'fi': 'Finnish',
        'uk': 'Ukrainian',
        'cs': 'Czech',
        'ro': 'Romanian',
        'hu': 'Hungarian',
        'unknown': 'Unknown'
    };

    const normalized = normalizeLanguageCode(code);
    if (languageNames[normalized]) return languageNames[normalized];

    const baseCode = code.toLowerCase().split('-')[0];
    return languageNames[baseCode] || code.toUpperCase();
}

export default {
    detectLanguageHeuristic,
    detectLyricsLanguage,
    detectRomanizedJapanese,
    detectChineseScript,
    refineChineseLanguageCode,
    normalizeLanguageCode,
    normalizeTargetLanguageCode,
    scanCorpusForCjk,
    isSameLanguage,
    isLikelyNonTargetLine,
    assessMixedLanguageContent,
    shouldSkipTranslation,
    clearDetectionCache,
    getLanguageName
};
