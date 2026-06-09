// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { parseProjectionConfig } from '../../src/projection.js';

describe('parseProjectionConfig — normalizations', () => {
  it('preserves a well-formed normalizations block', () => {
    const cfg = parseProjectionConfig({
      defaults: { strip: ['$container'] },
      types: {},
      normalizations: {
        inheritance: { as: 'extends', from: { Data: 'superType', RosettaEnumeration: 'parent' } },
        members: { as: 'members', from: { Data: 'attributes' } }
      }
    });
    expect(cfg.normalizations).toBeDefined();
    expect(cfg.normalizations!.inheritance.as).toBe('extends');
    expect(cfg.normalizations!.inheritance.from.Data).toBe('superType');
    expect(cfg.normalizations!.members.from.Data).toBe('attributes');
  });

  it('skips malformed entries (missing as / non-object from)', () => {
    const cfg = parseProjectionConfig({
      normalizations: {
        bad1: { from: { Data: 'x' } },
        bad2: { as: 'extends' },
        good: { as: 'extends', from: { Data: 'superType' } }
      }
    });
    expect(cfg.normalizations).toBeDefined();
    expect(cfg.normalizations!.bad1).toBeUndefined();
    expect(cfg.normalizations!.bad2).toBeUndefined();
    expect(cfg.normalizations!.good.as).toBe('extends');
  });

  it('leaves normalizations undefined when the block is absent', () => {
    const cfg = parseProjectionConfig({ defaults: { strip: [] }, types: {} });
    expect(cfg.normalizations).toBeUndefined();
  });
});
