import * as Yup from 'yup';
import { QuickReplyTemplate } from './InteractiveOptions/QuickReplyTemplate';
import { ListReplyTemplate } from './InteractiveOptions/ListReplyTemplate';
import { LIST, LOCATION_REQUEST, QUICK_REPLY } from 'common/constants';
import { getOrganizationServices } from 'services/AuthService';

/**
 * Per-interactive-type registry (ADR-016 / PRD-005 T16).
 *
 * Every place that used to branch on `templateType` (`QUICK_REPLY` / `LIST` /
 * `LOCATION_REQUEST_MESSAGE`, and eventually SwiftChat-only types) looks the
 * descriptor up here instead. Adding a new type means adding one entry to
 * `TYPE_REGISTRY` + `TYPE_ORDER` — no other file's switch/if chain should
 * need to change.
 *
 * Behavior-preserving refactor: every function below is a 1:1 port of the
 * per-type branch it replaces (see InteractiveMessage.tsx / .helper.ts git
 * history for the pre-refactor shape). Do not "clean up" the per-attribute
 * inner switches (media type, translation attribute, ...) — those are a
 * different axis than the interactive-type dispatch this registry owns.
 */

export interface BuildPayloadContext {
  /** raw form/state payload (title, body, footer, tagId, language, attachmentURL, ...) */
  payload: any;
  titleVal: string;
  templateButtonVal: Array<any>;
  globalButtonVal: any;
  /** the `type` state (media attachment type) — only meaningful for QUICK_REPLY */
  attachmentType?: any;
}

export interface InteractiveTypeDescriptor {
  id: string;
  label: string;
  /** ServiceType flag name (organizationServices) gating this type. Unset = always visible (R3). */
  flagged?: string;
  /** initial/empty shape for one row of `templateButtons` for this type */
  emptyButtonState: any;
  /** whether the Footer input is shown for this type */
  hasFooter: boolean;
  /** whether the attachment (media URL/upload) inputs are shown for this type */
  hasAttachments: boolean;
  /** whether this type has a "global button" (LIST's header) to restore/track */
  hasGlobalButton: boolean;
  handleInputChange: (buttons: Array<any>, index: number, value: string, payload: any) => Array<any>;
  getTemplateButtonPayload: (buttons: Array<any>) => Array<any>;
  buildPayload: (ctx: BuildPayloadContext) => { type: string; interactiveContent: string };
  convertJSONtoStateData: (data: any, label: string) => any;
  getDefaultValuesByTemplate: (data: any) => any;
  getTranslation: (attribute: string, defaultTemplate: any) => any;
  cleanMarkdown: (interactiveContent: any, cleanMarkdownFn: (input: any) => any) => any;
  validator: (t: any) => Record<string, any>;
  /**
   * F-107: the per-row options editor for this type.
   *
   * Before this, InteractiveOptions.getButtons() hardcoded `if LIST ... if
   * QUICK_REPLY ...` and returned null for anything else — so a newly
   * registered type rendered NO options editor and failed silently, looking
   * like a blank area rather than an error. Sub-forms take materially
   * different props, so the descriptor supplies both the component and a
   * builder for its props rather than assuming a common signature.
   *
   * Omit for types with no repeating options (scorecard, video_stream): the
   * dispatcher renders nothing, which is then correct rather than a bug.
   */
  subForm?: {
    component: any;
    buildProps: (ctx: SubFormContext) => Record<string, any>;
  };
}

/** Everything InteractiveOptions can offer a sub-form; each picks what it needs. */
export interface SubFormContext {
  index: number;
  inputFields: any;
  form: any;
  translation: any;
  arrayHelpers: any;
  setFieldValue: any;
  onInputChange: (type: string, index: number, value: string, payload: any, setFieldValue: any) => void;
  onAddClick: (helper: any, type: string) => void;
  onRemoveClick: (helper: any, idx: number) => void;
  onListItemAddClick: (index: number, options: Array<any>) => void;
  onListItemRemoveClick: (index: number, itemIndex: number) => void;
}

const getPayloadByMediaType = (mediaType: string, payload: any) => {
  const result: any = {};

  switch (mediaType) {
    case 'IMAGE':
    case 'VIDEO':
      result.type = `${mediaType.toLowerCase()}`;
      result.url = payload.attachmentURL;
      break;
    case 'DOCUMENT':
      result.type = 'file';
      result.url = payload.attachmentURL;
      result.filename = payload.attachmentURL?.substring(payload.attachmentURL.lastIndexOf('/') + 1);
      break;
    default:
      result.type = 'text';
      result.header = payload.title;
      break;
  }

  result.text = payload.body;
  if (payload.footer) {
    result.caption = payload.footer;
  }

  return result;
};

// needed since adding a new method to Yup does not add its type declarations
Yup.addMethod(Yup.array, 'unique', function uniqueMethod(message) {
  return this.test('unique', message, function test(list: any) {
    if (!list) return true;
    const titleMap: Array<string> = [];

    for (let listItem = 0; listItem < list.length; listItem += 1) {
      const { options } = list[listItem];

      if (!options) return true;
      const len = options.length;

      for (let i = 0; i < len; i += 1) {
        if (titleMap.includes(options[i].title)) {
          return this.createError({
            path: `templateButtons[${listItem}].options[${i}].title`,
            message,
          });
        }
        titleMap.push(options[i].title);
      }
    }

    return true;
  });
});

const quickReplyDescriptor: InteractiveTypeDescriptor = {
  subForm: {
    component: QuickReplyTemplate,
    buildProps: ({
      index,
      inputFields,
      form,
      translation,
      arrayHelpers,
      setFieldValue,
      onInputChange,
      onAddClick,
      onRemoveClick,
    }: SubFormContext) => ({
      translation: translation && translation[index],
      index,
      inputFields,
      form,
      onInputChange: (value: string, payload: any) => onInputChange(QUICK_REPLY, index, value, payload, setFieldValue),
      onAddClick: () => onAddClick(arrayHelpers, QUICK_REPLY),
      onRemoveClick: () => onRemoveClick(arrayHelpers, index),
    }),
  },
  id: QUICK_REPLY,
  label: 'Reply buttons',
  emptyButtonState: { value: '' },
  hasFooter: true,
  hasAttachments: true,
  hasGlobalButton: false,

  handleInputChange: (buttons, index, value, payload) => {
    const { key } = payload;
    return buttons.map((row: any, idx: number) => {
      if (idx === index) {
        return { ...row, [key]: value };
      }
      return row;
    });
  },

  getTemplateButtonPayload: (buttons) => buttons.map((button: any) => ({ type: 'text', title: button.value })),

  buildPayload: ({ payload, templateButtonVal, attachmentType }) => {
    const content = getPayloadByMediaType(attachmentType?.id, payload);
    const quickReplyOptions = quickReplyDescriptor.getTemplateButtonPayload(templateButtonVal);
    const quickReplyJSON = { type: 'quick_reply', content, options: quickReplyOptions };

    return { type: QUICK_REPLY, interactiveContent: JSON.stringify(quickReplyJSON) };
  },

  convertJSONtoStateData: (data, label) => {
    const { content, options } = data;
    const { type, header, url, text, caption } = content;
    const result: any = {};

    result.templateButtons = options.map((option: any) => ({ value: option.title }));
    result.title = header || '';

    switch (type) {
      case 'image':
      case 'video':
        result.type = type.toUpperCase();
        result.attachmentURL = url;
        result.title = label;
        break;
      case 'file':
        result.type = 'DOCUMENT';
        result.attachmentURL = url;
        result.title = label;
        break;
      default:
        result.type = null;
    }

    result.body = text || '';
    result.footer = caption;
    return result;
  },

  getDefaultValuesByTemplate: (data) => {
    const { type, content, options } = data;
    const updatedOptions = options.map(() => ({ type: 'text', title: '' }));
    const updatedContent = Object.keys(content).reduce((res: any, key: string) => {
      if (['type', 'url'].includes(key)) res[key] = content[key];
      else res[key] = '';
      return res;
    }, {});

    return { type, content: updatedContent, options: updatedOptions };
  },

  getTranslation: (attribute, defaultTemplate) => {
    switch (attribute) {
      case 'title':
        return defaultTemplate.content.header;
      case 'body':
        return defaultTemplate.content.text;
      case 'footer':
        return defaultTemplate.content.caption;
      case 'options':
        return defaultTemplate.options.map((option: any) => option.title);
      default:
        return null;
    }
  },

  cleanMarkdown: (interactiveContent, cleanMarkdownFn) => ({
    ...interactiveContent,
    options: cleanMarkdownFn(interactiveContent.options),
  }),

  validator: (t) => ({
    templateButtons: Yup.array()
      .of(
        Yup.object().shape({
          value: Yup.string().required(t('Required')).max(20, t('Button value can be at most 20 characters')),
        })
      )
      .min(1)
      .max(3)
      .test('unique-values', 'Button labels must be unique.', (array: any) => {
        const values = array.map((item: any) => item.value);
        return new Set(values).size === values.length;
      }),
    footer: Yup.string().nullable().max(60, t('Footer value can be at most 60 characters')),
    type: Yup.object()
      .nullable()
      .when('attachmentURL', {
        is: (val: string) => val && val !== '',
        then: (schema: any) => schema.nullable().required(t('Type is required.')),
      }),
    attachmentURL: Yup.string()
      .nullable()
      .when('type', {
        is: (val: any) => val && val.id,
        then: (schema: any) => schema.required(t('Attachment URL is required.')),
      }),
  }),
};

const listDescriptor: InteractiveTypeDescriptor = {
  subForm: {
    component: ListReplyTemplate,
    buildProps: ({
      index,
      inputFields,
      form,
      translation,
      arrayHelpers,
      setFieldValue,
      onInputChange,
      onAddClick,
      onRemoveClick,
      onListItemAddClick,
      onListItemRemoveClick,
    }: SubFormContext) => ({
      translation: translation && translation.items && translation.items[index],
      index,
      inputFields,
      form,
      onListAddClick: () => onAddClick(arrayHelpers, LIST),
      onListRemoveClick: () => onRemoveClick(arrayHelpers, index),
      onListItemAddClick: (options: Array<any>) => onListItemAddClick(index, options),
      onListItemRemoveClick: (itemIndex: number) => onListItemRemoveClick(index, itemIndex),
      onInputChange: (value: string, payload: any) => onInputChange(LIST, index, value, payload, setFieldValue),
    }),
  },
  id: LIST,
  label: 'List message',
  emptyButtonState: { title: '', options: [{ title: '', description: '' }] },
  hasFooter: false,
  hasAttachments: false,
  hasGlobalButton: true,

  handleInputChange: (buttons, index, value, payload) => {
    const { key, itemIndex, isOption } = payload;
    return buttons.map((row: any, idx: number) => {
      const { options }: { options: Array<any> } = row;
      if (idx === index) {
        if (isOption) {
          const updatedOptions = options.map((option: any, optionIdx: number) => {
            if (optionIdx === itemIndex) {
              return { ...option, [key]: value };
            }
            return option;
          });

          return { ...row, options: updatedOptions };
        }

        return { ...row, [key]: value };
      }

      return row;
    });
  },

  getTemplateButtonPayload: (buttons) =>
    buttons.map((button: any) => {
      const { title: sectionTitle, options: sectionOptions } = button;
      const sectionOptionsObject = sectionOptions?.map((option: any) => ({
        type: 'text',
        title: option.title,
        description: option.description,
      }));
      return {
        title: sectionTitle,
        subtitle: sectionTitle,
        options: sectionOptionsObject,
      };
    }),

  buildPayload: ({ payload, titleVal, templateButtonVal, globalButtonVal }) => {
    const bodyText = payload.body;
    const items = listDescriptor.getTemplateButtonPayload(templateButtonVal);
    const globalButtons = [{ type: 'text', title: globalButtonVal }];

    const listJSON = { type: 'list', title: titleVal, body: bodyText, globalButtons, items };
    return { type: LIST, interactiveContent: JSON.stringify(listJSON) };
  },

  convertJSONtoStateData: (data) => {
    const { title, body, items, globalButtons } = data;
    const result: any = {};

    result.templateButtons = items.map((item: any) => {
      const itemOptions = item.options.map((option: any) => ({
        title: option.title,
        description: option.description,
      }));
      return {
        title: item.title,
        options: itemOptions,
      };
    });
    result.body = body;
    result.title = title;
    result.globalButton = globalButtons[0].title;
    return result;
  },

  getDefaultValuesByTemplate: (data) =>
    Object.keys(data).reduce((res: any, key: string) => {
      const dataVal = data[key];
      if (typeof dataVal === 'string') {
        res[key] = '';
      }

      if (key === 'items') {
        res[key] = dataVal.map((item: any) => {
          const optionVal = { type: 'text', title: '', description: '' };
          const { options } = item;
          const updatedOptions = options.map(() => optionVal);
          return { title: '', subtitle: '', options: updatedOptions };
        });
      }

      if (key === 'globalButtons') {
        res[key] = dataVal.map(() => ({ type: 'text', title: '' }));
      }

      return res;
    }, {}),

  getTranslation: (attribute, defaultTemplate) => {
    switch (attribute) {
      case 'title':
        return defaultTemplate.title;
      case 'body':
        return defaultTemplate.body;
      case 'options':
        return {
          items: defaultTemplate.items,
          globalButton: defaultTemplate.globalButtons[0].title,
        };
      default:
        return null;
    }
  },

  cleanMarkdown: (interactiveContent, cleanMarkdownFn) => {
    const cleanedItems = interactiveContent.items.map((item: any) => ({
      ...item,
      options: cleanMarkdownFn(item.options),
    }));
    const { body, items, ...rest } = interactiveContent;
    return { ...cleanMarkdownFn(rest), items: cleanedItems, body };
  },

  validator: (t) => ({
    templateButtons: Yup.array()
      .of(
        Yup.object().shape({
          title: Yup.string().required(t('Required')).max(24, t('Section title can be at most 24 characters')),
          options: Yup.array().of(
            Yup.object().shape({
              title: Yup.string()
                .test('is-emoji', t('Sorry! Emojis are not allowed in the title'), (value) => {
                  if (value) {
                    const testEmoji = /\p{Emoji_Presentation}/gu.test(value);
                    return !testEmoji;
                  }
                  return true;
                })
                .required(t('Title is required'))
                .max(24, t('Title can be at most 24 characters')),
              description: Yup.string().max(72, t('Description can be at most 72 characters')),
            })
          ),
        })
      )
      // @ts-ignore — `.unique` is added via Yup.addMethod above; no type declarations for it
      .unique(t('Please enter unique title'))
      .min(1),
    globalButton: Yup.string().required(t('Required')).max(20, t('Button value can be at most 20 characters')),
  }),
};

const locationRequestDescriptor: InteractiveTypeDescriptor = {
  id: LOCATION_REQUEST,
  label: 'Location request',
  emptyButtonState: {},
  hasFooter: false,
  hasAttachments: false,
  hasGlobalButton: false,

  handleInputChange: (buttons) => buttons,
  getTemplateButtonPayload: () => [],

  buildPayload: ({ payload }) => {
    const bodyText = payload.body;
    const locationJson = {
      type: 'location_request_message',
      body: {
        type: 'text',
        text: bodyText,
      },
      action: {
        name: 'send_location',
      },
    };
    return { type: LOCATION_REQUEST, interactiveContent: JSON.stringify(locationJson) };
  },

  convertJSONtoStateData: (data, label) => ({ body: data.body.text, title: label }),

  getDefaultValuesByTemplate: () => ({ body: { text: '' }, title: '' }),

  getTranslation: (attribute, defaultTemplate) => {
    switch (attribute) {
      case 'title':
        return defaultTemplate.title;
      case 'body':
        return defaultTemplate.body.text;
      default:
        return null;
    }
  },

  cleanMarkdown: (interactiveContent) => interactiveContent,

  validator: () => ({}),
};

// Registration order == authoring dropdown order. Add new types here.
const TYPE_ORDER = [QUICK_REPLY, LIST, LOCATION_REQUEST];

const TYPE_REGISTRY: Record<string, InteractiveTypeDescriptor> = {
  [QUICK_REPLY]: quickReplyDescriptor,
  [LIST]: listDescriptor,
  [LOCATION_REQUEST]: locationRequestDescriptor,
};

export const getTypeDescriptor = (id: string | null | undefined): InteractiveTypeDescriptor | undefined =>
  id ? TYPE_REGISTRY[id] : undefined;

/**
 * Feature-flag filter (PRD-005 T17, R3). Split out as a pure function so the
 * filtering mechanism can be unit-tested against a synthetic flagged entry
 * without mutating the real registry.
 */
export const filterTypesByFlag = (
  entries: Array<InteractiveTypeDescriptor>,
  isFlagEnabled: (flag: string) => any
): Array<InteractiveTypeDescriptor> => entries.filter((entry) => !entry.flagged || !!isFlagEnabled(entry.flagged));

export const getTemplateTypeOptions = (): Array<{ id: string; label: string }> => {
  const orderedEntries = TYPE_ORDER.map((id) => TYPE_REGISTRY[id]);
  // `flagged` is a plain string here (new type descriptors can point at a service flag
  // before that flag's literal is added to AuthService's private `ServiceType` union) —
  // cast at this one boundary call rather than widening `ServiceType` itself.
  const isFlagEnabled = (flag: string) =>
    getOrganizationServices(flag as Parameters<typeof getOrganizationServices>[0]);
  return filterTypesByFlag(orderedEntries, isFlagEnabled).map(({ id, label }) => ({ id, label }));
};
