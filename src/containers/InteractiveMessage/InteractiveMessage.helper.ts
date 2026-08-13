import axios from 'axios';
import { FLOW_EDITOR_API } from 'config';
import { getAuthSession } from 'services/AuthService';
import * as Yup from 'yup';
import { getTypeDescriptor } from './typeRegistry';

/**
 * Per-type dispatch (the `switch (interactiveType)` this file used to have
 * for validator/convertJSONtoStateData/getDefaultValuesByTemplate/
 * getTranslation) now lives in `typeRegistry.ts` (PRD-005 T16 — ADR-016).
 * These functions keep their original external signature/behavior and are
 * a thin lookup into the registry, with the same "unknown type" fallback
 * the original switch statements had (empty object / null).
 */

export const validator = (templateType: any, t: any) => {
  const validation: any = {
    title: Yup.string().required(t('Title is required')).max(60, t('Title can be at most 60 characters')),
    body: Yup.string().when('type', {
      is: (val: any) => val && val.id && val.id === 'DOCUMENT',
      then: (schema) => schema.nullable(),
      otherwise: (schema) => schema.required(t('Message content is required.')),
    }),
  };

  const descriptor = getTypeDescriptor(templateType);
  return { ...validation, ...(descriptor ? descriptor.validator(t) : {}) };
};

export const convertJSONtoStateData = (JSONData: any, interactiveType: string, label: string) => {
  const data = { ...JSONData };
  const descriptor = getTypeDescriptor(interactiveType);
  return descriptor ? descriptor.convertJSONtoStateData(data, label) : {};
};

export const getDefaultValuesByTemplate = (templateData: any) => {
  const { type: templateType, interactiveContent } = templateData;
  const data = JSON.parse(interactiveContent);
  const descriptor = getTypeDescriptor(templateType);
  return descriptor ? descriptor.getDefaultValuesByTemplate(data) : {};
};

export const getVariableOptions = async (setContactVariables: any) => {
  const glificBase = FLOW_EDITOR_API;

  const contactFieldsprefix = '@contact.fields.';
  const contactVariablesprefix = '@contact.';
  const headers = { authorization: getAuthSession('access_token') };
  // get fields keys
  const fieldsData = await axios.get(`${glificBase}fields`, {
    headers,
  });

  const fields = fieldsData.data.results.map((i: any) => contactFieldsprefix.concat(i.key));

  // get contact keys
  const contactData = await axios.get(`${glificBase}completion`, {
    headers,
  });

  const properties = contactData.data.context.types.find(({ name }: { name: string }) => name === 'contact');

  const contacts =
    properties &&
    properties.properties
      .map((i: any) => contactVariablesprefix.concat(i.key))
      .concat(fields)
      .map((val: string) => val)
      .slice(1);

  setContactVariables(contacts);
};

export const getTranslation = (interactiveType: string, attribute: any, translations: any, defaultLanguage: any) => {
  if (defaultLanguage.id) {
    const defaultTemplate = JSON.parse(translations)[defaultLanguage.id];

    if (!defaultTemplate) {
      return null;
    }

    const descriptor = getTypeDescriptor(interactiveType);
    return descriptor ? descriptor.getTranslation(attribute, defaultTemplate) : null;
  }
  return null;
};
