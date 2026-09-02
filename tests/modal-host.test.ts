import test from 'node:test';
import assert from 'node:assert/strict';
import { createModalHost } from '../src/utils/modal';

type Calls = { created: string[] };

function installDocument(options: {
    templateWorks?: boolean;
    customElementThrows?: boolean;
}): Calls {
    const calls: Calls = { created: [] };
    const templateWorks = options.templateWorks !== false;

    (globalThis as any).document = {
        createElement(tag: string) {
            calls.created.push(tag);

            if (tag === 'template') {
                if (!templateWorks) throw new Error('template unsupported');
                const template: any = {
                    content: { firstElementChild: null },
                    set innerHTML(html: string) {
                        const match = /^<([a-z-]+)>/.exec(html);
                        template.content.firstElementChild = match
                            ? { tagName: match[1].toUpperCase(), classList: { add: () => {} } }
                            : null;
                    }
                };
                return template;
            }

            if (tag === 'sl-generic-modal' && options.customElementThrows) {
                throw new Error("Failed to execute 'createElement' on 'Document': The result must not have attributes");
            }

            return { tagName: tag.toUpperCase(), classList: { add: () => {} } };
        }
    };

    return calls;
}

test('createModalHost builds the custom element by parsing, not createElement', () => {
    const calls = installDocument({ customElementThrows: true });

    const host = createModalHost() as any;

    assert.equal(host.tagName, 'SL-GENERIC-MODAL');
    assert.deepEqual(calls.created, ['template']);
    assert.equal(calls.created.includes('sl-generic-modal'), false);
});

test('createModalHost still yields the custom element when the constructor is well behaved', () => {
    installDocument({ customElementThrows: false });

    const host = createModalHost() as any;

    assert.equal(host.tagName, 'SL-GENERIC-MODAL');
});

test('createModalHost falls back to createElement when templates are unavailable', () => {
    const calls = installDocument({ templateWorks: false, customElementThrows: false });

    const host = createModalHost() as any;

    assert.equal(host.tagName, 'SL-GENERIC-MODAL');
    assert.deepEqual(calls.created, ['template', 'sl-generic-modal']);
});

test('createModalHost falls back to a plain div when every custom element path fails', () => {
    const calls = installDocument({ templateWorks: false, customElementThrows: true });

    const host = createModalHost() as any;

    assert.equal(host.tagName, 'DIV');
    assert.deepEqual(calls.created, ['template', 'sl-generic-modal', 'div']);
});
