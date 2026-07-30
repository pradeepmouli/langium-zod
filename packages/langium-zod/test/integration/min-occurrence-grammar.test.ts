import { describe, it, expect } from 'vitest';
import { EmptyFileSystem, type Grammar } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { generateZodSchemas } from '../../src/api.js';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const parse = parseHelper<Grammar>(services);

async function grammarFrom(src: string): Promise<Grammar> {
  const doc = await parse(src);
  return doc.parseResult.value;
}

describe('min-occurrence from a real parsed grammar', () => {
  it('emits .min(1) for the comma-list idiom x+=A (\',\' x+=A)*', async () => {
    const grammar = await grammarFrom(
      `grammar Test
entry Model: items+=Item (',' items+=Item)*;
Item: name=ID;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    // Generator wraps property keys in double quotes: "items": z.array(...)
    expect(source).toMatch(/"items":\s*z\.array\([^)]*\)\.min\(1\)/);
  });

  it('does NOT emit .min(1) for an optional array (items+=Item)*', async () => {
    const grammar = await grammarFrom(
      `grammar Test2
entry Model: (items+=Item)*;
Item: name=ID;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).not.toMatch(/"items":\s*z\.array\([^)]*\)\.min\(1\)/);
  });

  it('does NOT emit .min(1) when the array is in one branch of an Alternatives', async () => {
    // `'all' | items+=Item (…)*` — valid docs taking the `'all'` branch have items:[],
    // which would fail .min(1); must conservatively omit .min(1).
    const grammar = await grammarFrom(
      `grammar Test3
entry Model: 'all' | items+=Item (',' items+=Item)*;
Item: name=ID;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).not.toMatch(/"items":\s*z\.array\([^)]*\)\.min\(1\)/);
  });

  it('emits .min(1) for a cross-ref comma-list (refs+=[Item:ID] (\',\' refs+=[Item:ID])*)', async () => {
    // Proves the RosettaSynonym sources+=[Src] (',' sources+=[Src])* shape works.
    const grammar = await grammarFrom(
      `grammar Test4
entry Model: refs+=[Item:ID] (',' refs+=[Item:ID])*;
Item: name=ID;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).toMatch(/"refs":\s*z\.array\([^)]*\)\.min\(1\)/);
  });

  it('does NOT emit .min(1) for += inside a fragment used in an optional context', async () => {
    // Fragment assignments end their $container chain at the fragment rule, NOT the
    // use site `(Syns)*` — isMandatoryOccurrence would wrongly return true without the
    // fragment guard. A parsed Model with no Syns has syns:[], which fails .min(1).
    const grammar = await grammarFrom(
      `grammar Test5
entry Model: name=ID (Syns)*;
fragment Syns: syns+=Syn;
Syn: name=ID;
terminal ID: /[a-z]+/;
hidden terminal WS: /\\s+/;`
    );
    const source = generateZodSchemas({ grammar });
    expect(source).not.toMatch(/"syns":\s*z\.array\([^)]*\)\.min\(1\)/);
  });
});
