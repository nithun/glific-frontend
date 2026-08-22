import { TextField, FormHelperText, FormControl, MenuItem } from '@mui/material';

import CrossIcon from 'assets/images/icons/Cross.svg?react';
import AddIcon from 'assets/images/icons/SquareAdd.svg?react';
import styles from './QuickReplyTemplate.module.css';

/**
 * One field within a repeating row.
 *
 * `options` turns the input into a select — used by rich_input form, whose
 * per-row field type decides which other inputs are even legal (SwiftChat
 * requires is_sensitive on a text field and REJECTS it on a dropdown).
 */
export interface RowField {
  key: string;
  label: string;
  placeholder?: string;
  options?: Array<{ id: string; label: string }>;
  multiline?: boolean;
}

export interface FieldRowTemplateProps {
  index: number;
  inputFields: any;
  form: { touched: any; errors: any; values: any };
  fields: RowField[];
  heading: string;
  maxRows: number;
  onAddClick: any;
  onRemoveClick: any;
  onInputChange: any;
  translation?: any;
}

/**
 * A generic repeating-row editor for interactive types whose options are a
 * list of records (article, contacts, action, card, catalog_list,
 * product_list, rich_input form).
 *
 * Written as ONE data-driven component rather than seven near-identical ones:
 * they differ only in which fields a row carries, so a per-type component
 * would be seven copies of the same add/remove/validate scaffolding, seven
 * places for the row-limit logic to drift, and a much harder upstream review.
 */
export const FieldRowTemplate = ({
  index,
  inputFields,
  form: { touched, errors },
  fields,
  heading,
  maxRows,
  onAddClick,
  onRemoveClick,
  onInputChange,
  translation,
}: FieldRowTemplateProps) => {
  const isError = (key: string) =>
    !!(
      errors.templateButtons &&
      touched.templateButtons &&
      errors.templateButtons[index] &&
      errors.templateButtons[index][key]
    );

  const handleChange = (event: any, key: string) => onInputChange(event.target.value, { key });

  // Only the LAST row gets the remove control alongside add, matching
  // QuickReplyTemplate — and never when a single row is all that is left,
  // since every one of these types requires at least one.
  const removeIcon = inputFields.length > 1 && (
    <CrossIcon className={styles.RemoveIcon} title="Remove" data-testid="cross-icon" onClick={onRemoveClick} />
  );

  return (
    <>
      {index === 0 && <div className={styles.Heading}>{heading}</div>}
      {translation && <div className={styles.Translation}>{translation}</div>}
      <div className={styles.WrapperBackground}>
        <div className={styles.QuickReplyWrapper}>
          {fields.map((field: RowField, fieldIndex: number) => (
            <FormControl fullWidth key={field.key} error={isError(field.key)} className={styles.FormControl}>
              <TextField
                select={!!field.options}
                multiline={!!field.multiline}
                placeholder={field.placeholder || field.label}
                label={field.label}
                variant="outlined"
                data-testid={`row-${field.key}`}
                onChange={(e: any) => handleChange(e, field.key)}
                value={(inputFields && inputFields[index]?.[field.key]) || ''}
                className={styles.TextField}
                InputProps={
                  // the remove control belongs on the first field only, or it
                  // repeats once per field and reads as several delete buttons
                  fieldIndex === 0 ? { endAdornment: removeIcon } : undefined
                }
                error={isError(field.key)}
              >
                {field.options?.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              {isError(field.key) ? (
                <FormHelperText>{errors.templateButtons[index]?.[field.key]}</FormHelperText>
              ) : null}
            </FormControl>
          ))}
        </div>
        {inputFields.length === index + 1 && inputFields.length < maxRows ? (
          <div data-testid="addButton" onClick={onAddClick} className={styles.AddButton}>
            <AddIcon className={styles.AddIcon} />
          </div>
        ) : null}
      </div>
    </>
  );
};
