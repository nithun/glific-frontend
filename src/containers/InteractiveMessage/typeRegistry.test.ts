import { LIST, LOCATION_REQUEST, QUICK_REPLY } from 'common/constants';
import { getOrganizationServices } from 'services/AuthService';
import {
  filterTypesByFlag,
  getTemplateTypeOptions,
  getTypeDescriptor,
  InteractiveTypeDescriptor,
} from './typeRegistry';

vi.mock('services/AuthService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('services/AuthService')>();
  return {
    ...actual,
    getOrganizationServices: vi.fn(() => false),
  };
});

describe('typeRegistry — descriptor lookup (T16)', () => {
  test('resolves a descriptor for each of the 3 existing types', () => {
    expect(getTypeDescriptor(QUICK_REPLY)?.id).toBe(QUICK_REPLY);
    expect(getTypeDescriptor(LIST)?.id).toBe(LIST);
    expect(getTypeDescriptor(LOCATION_REQUEST)?.id).toBe(LOCATION_REQUEST);
  });

  test('returns undefined (safe fallback) for an unknown type instead of throwing', () => {
    expect(getTypeDescriptor('SOME_FUTURE_SWIFTCHAT_TYPE')).toBeUndefined();
    expect(getTypeDescriptor(null)).toBeUndefined();
    expect(getTypeDescriptor(undefined)).toBeUndefined();
  });

  test('QUICK_REPLY descriptor builds the same payload shape the old convertStateDataToJSON branch did', () => {
    const descriptor = getTypeDescriptor(QUICK_REPLY) as InteractiveTypeDescriptor;
    const { type, interactiveContent } = descriptor.buildPayload({
      payload: { title: 'hi', body: 'body text', footer: 'foot' },
      titleVal: 'hi',
      templateButtonVal: [{ value: 'Yes' }, { value: 'No' }],
      globalButtonVal: undefined,
      attachmentType: undefined,
    });

    expect(type).toBe(QUICK_REPLY);
    expect(JSON.parse(interactiveContent)).toEqual({
      type: 'quick_reply',
      content: { type: 'text', header: 'hi', text: 'body text', caption: 'foot' },
      options: [
        { type: 'text', title: 'Yes' },
        { type: 'text', title: 'No' },
      ],
    });
  });

  test('LIST descriptor builds the same payload shape the old convertStateDataToJSON branch did', () => {
    const descriptor = getTypeDescriptor(LIST) as InteractiveTypeDescriptor;
    const { type, interactiveContent } = descriptor.buildPayload({
      payload: { body: 'pick one' },
      titleVal: 'title',
      templateButtonVal: [{ title: 'Section', options: [{ title: 'A', description: 'a' }] }],
      globalButtonVal: 'Menu',
      attachmentType: undefined,
    });

    expect(type).toBe(LIST);
    expect(JSON.parse(interactiveContent)).toEqual({
      type: 'list',
      title: 'title',
      body: 'pick one',
      globalButtons: [{ type: 'text', title: 'Menu' }],
      items: [
        {
          title: 'Section',
          subtitle: 'Section',
          options: [{ type: 'text', title: 'A', description: 'a' }],
        },
      ],
    });
  });

  test('LOCATION_REQUEST descriptor builds the same payload shape the old convertStateDataToJSON branch did', () => {
    const descriptor = getTypeDescriptor(LOCATION_REQUEST) as InteractiveTypeDescriptor;
    const { type, interactiveContent } = descriptor.buildPayload({
      payload: { body: 'share your location' },
      titleVal: '',
      templateButtonVal: [],
      globalButtonVal: undefined,
      attachmentType: undefined,
    });

    expect(type).toBe(LOCATION_REQUEST);
    expect(JSON.parse(interactiveContent)).toEqual({
      type: 'location_request_message',
      body: { type: 'text', text: 'share your location' },
      action: { name: 'send_location' },
    });
  });

  test('only QUICK_REPLY has footer/attachments; only LIST has a global button', () => {
    expect(getTypeDescriptor(QUICK_REPLY)?.hasFooter).toBe(true);
    expect(getTypeDescriptor(QUICK_REPLY)?.hasAttachments).toBe(true);
    expect(getTypeDescriptor(QUICK_REPLY)?.hasGlobalButton).toBe(false);

    expect(getTypeDescriptor(LIST)?.hasFooter).toBe(false);
    expect(getTypeDescriptor(LIST)?.hasAttachments).toBe(false);
    expect(getTypeDescriptor(LIST)?.hasGlobalButton).toBe(true);

    expect(getTypeDescriptor(LOCATION_REQUEST)?.hasFooter).toBe(false);
    expect(getTypeDescriptor(LOCATION_REQUEST)?.hasAttachments).toBe(false);
    expect(getTypeDescriptor(LOCATION_REQUEST)?.hasGlobalButton).toBe(false);
  });
});

describe('typeRegistry — feature-flag filtering mechanism (T17, R3)', () => {
  const baseDescriptor: InteractiveTypeDescriptor = {
    id: 'UNFLAGGED_TYPE',
    label: 'Unflagged type',
    emptyButtonState: {},
    hasFooter: false,
    hasAttachments: false,
    hasGlobalButton: false,
    handleInputChange: (buttons) => buttons,
    getTemplateButtonPayload: () => [],
    buildPayload: () => ({ type: 'UNFLAGGED_TYPE', interactiveContent: '{}' }),
    convertJSONtoStateData: () => ({}),
    getDefaultValuesByTemplate: () => ({}),
    getTranslation: () => null,
    cleanMarkdown: (content) => content,
    validator: () => ({}),
  };

  test('an entry with no `flagged` is always included, regardless of flag state', () => {
    expect(filterTypesByFlag([baseDescriptor], () => false)).toEqual([baseDescriptor]);
    expect(filterTypesByFlag([baseDescriptor], () => true)).toEqual([baseDescriptor]);
  });

  test('a synthetic flagged entry is excluded when its flag is disabled', () => {
    const flaggedDescriptor: InteractiveTypeDescriptor = {
      ...baseDescriptor,
      id: 'SWIFTCHAT_ONLY_TYPE',
      flagged: 'swiftchatInteractiveTypesEnabled',
    };

    const result = filterTypesByFlag(
      [baseDescriptor, flaggedDescriptor],
      (flag) => flag === 'swiftchatInteractiveTypesEnabled' && false
    );

    expect(result).toEqual([baseDescriptor]);
  });

  test('a synthetic flagged entry is included when its flag is enabled', () => {
    const flaggedDescriptor: InteractiveTypeDescriptor = {
      ...baseDescriptor,
      id: 'SWIFTCHAT_ONLY_TYPE',
      flagged: 'swiftchatInteractiveTypesEnabled',
    };

    const isFlagEnabled = (flag: string) => flag === 'swiftchatInteractiveTypesEnabled';
    const result = filterTypesByFlag([baseDescriptor, flaggedDescriptor], isFlagEnabled);

    expect(result).toEqual([baseDescriptor, flaggedDescriptor]);
  });

  test('getTemplateTypeOptions() always returns all 3 existing types — none of them are flagged yet, so WhatsApp orgs see zero diff regardless of the swiftchatInteractiveTypesEnabled value', () => {
    const options = getTemplateTypeOptions();
    expect(options.map((option) => option.id).sort()).toEqual([LIST, LOCATION_REQUEST, QUICK_REPLY].sort());
  });
});

describe('typeRegistry — swiftchatInteractiveTypesEnabled wiring (T17)', () => {
  // Exercises the real getOrganizationServices call site inside getTemplateTypeOptions()
  // (not just the pure filterTypesByFlag helper) — proves the exact flag-name string
  // `swiftchatInteractiveTypesEnabled` is what gets asked for, matching the cross-repo
  // contract with the backend flag field (PRD-005 T12).
  test('getTemplateTypeOptions() calls getOrganizationServices with the flag name only for entries that declare `flagged`', () => {
    vi.mocked(getOrganizationServices).mockClear();
    getTemplateTypeOptions();

    // The tripwire this test was written as has now fired, as its original
    // comment predicted: the SwiftChat row types register with
    // flagged: 'swiftchatInteractiveTypesEnabled', so the flag IS queried.
    expect(getOrganizationServices).toHaveBeenCalledWith('swiftchatInteractiveTypesEnabled');
  });

  test('flag OFF hides the SwiftChat types; ON reveals them (WhatsApp types unaffected either way)', () => {
    vi.mocked(getOrganizationServices).mockReturnValue(false);
    const flagOff = getTemplateTypeOptions().map((option: any) => option.id);

    vi.mocked(getOrganizationServices).mockReturnValue(true);
    const flagOn = getTemplateTypeOptions().map((option: any) => option.id);

    // The three WhatsApp-era types are unflagged and must survive both states —
    // this is the half of the original assertion that still matters.
    for (const unflagged of ['QUICK_REPLY', 'LIST', 'LOCATION_REQUEST_MESSAGE']) {
      expect(flagOff).toContain(unflagged);
      expect(flagOn).toContain(unflagged);
    }

    // ...and the flagged ones appear only when the flag is on.
    for (const flagged of ['ACTION', 'ARTICLE', 'CARD', 'SWIFTCHAT_CONTACTS', 'RICH_INPUT']) {
      expect(flagOff).not.toContain(flagged);
      expect(flagOn).toContain(flagged);
    }

    expect(flagOn.length).toBeGreaterThan(flagOff.length);

    vi.mocked(getOrganizationServices).mockReturnValue(false);
  });
});
