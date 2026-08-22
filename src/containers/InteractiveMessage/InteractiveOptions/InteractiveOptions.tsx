import { FormControl, TextField, FormHelperText, Typography } from '@mui/material';
import { getTypeDescriptor } from '../typeRegistry';
import { FieldArray } from 'formik';

import { QUICK_REPLY, LIST, LOCATION_REQUEST } from 'common/constants';
import { QuickReplyTemplate } from './QuickReplyTemplate';
import { ListReplyTemplate } from './ListReplyTemplate';
import styles from './InteractiveOptions.module.css';

export interface InteractiveOptionsProps {
  isAddButtonChecked: boolean;
  templateType: string | null;
  inputFields: Array<any>;
  form: { touched: any; errors: any; values: any; setFieldValue: any };
  onAddClick: any;
  onRemoveClick: any;
  onInputChange: any;
  onTemplateTypeChange: any;
  onListItemAddClick: any;
  onListItemRemoveClick: any;
  onGlobalButtonInputChange: any;
  disabled: any;
  translation?: any;
  disabledType?: any;
}
export const InteractiveOptions = ({
  isAddButtonChecked,
  templateType,
  inputFields,
  form,
  onAddClick,
  onRemoveClick,
  onInputChange,
  onGlobalButtonInputChange,
  onListItemAddClick,
  onListItemRemoveClick,
  disabled = false,
  translation,
}: InteractiveOptionsProps) => {
  const { values, errors, touched, setFieldValue } = form;

  const handleAddClick = (helper: any, type: string) => {
    const obj = type === LIST ? { title: '', options: [] } : { value: '' };
    helper.push(obj);
    onAddClick(true, type);
  };

  const handleRemoveClick = (helper: any, idx: number) => {
    helper.remove(idx);
    onRemoveClick(idx);
  };

  // F-107: dispatch through the type registry instead of an if/else chain.
  // The old version hardcoded LIST and QUICK_REPLY and returned null for
  // anything else, so a newly registered type rendered a blank options area
  // with no error — the failure looked like a layout bug rather than a
  // missing form. A type with no repeating options simply declares no
  // subForm, and rendering nothing is then correct.
  const getButtons = (index: number, arrayHelpers: any) => {
    const descriptor: any = getTypeDescriptor(templateType);

    if (!descriptor || !descriptor.subForm) {
      return null;
    }

    const { component: SubForm, buildProps } = descriptor.subForm;

    return (
      <SubForm
        key={index}
        {...buildProps({
          index,
          inputFields,
          form,
          translation,
          arrayHelpers,
          setFieldValue,
          onInputChange,
          onAddClick: handleAddClick,
          onRemoveClick: handleRemoveClick,
          onListItemAddClick,
          onListItemRemoveClick,
        })}
      />
    );
  };

  const radioTemplateType = (
    <div>
      {templateType && templateType === LIST && (
        <div className={styles.GlobalButton}>
          {translation && <div className={styles.Translation}>{translation.globalButton}</div>}
          <FormControl fullWidth error={!!(errors.globalButton && touched.globalButton)} className={styles.FormControl}>
            <Typography variant="h5" className={styles.FieldLabel}>
              List header*
            </Typography>
            <TextField
              className={styles.TextField}
              onChange={(e: any) => {
                setFieldValue('globalButton', e.target.value);
                onGlobalButtonInputChange(e.target.value);
              }}
              value={values.globalButton}
              error={!!errors.globalButton && touched.globalButton}
            />
            {errors.globalButton && touched.globalButton && <FormHelperText>{errors.globalButton}</FormHelperText>}
          </FormControl>
        </div>
      )}
      {templateType && templateType !== LOCATION_REQUEST && (
        <div className={templateType === QUICK_REPLY ? styles.TemplateFields : styles.TemplateFieldsList}>
          <FieldArray
            name="templateButtons"
            render={(arrayHelpers: any) =>
              values.templateButtons.map((row: any, index: any) => getButtons(index, arrayHelpers))
            }
          />
        </div>
      )}
      {errors.templateButtons && typeof errors.templateButtons === 'string' && (
        <FormHelperText className={styles.Error}>{errors.templateButtons}</FormHelperText>
      )}
    </div>
  );

  return <div>{isAddButtonChecked && !disabled && radioTemplateType}</div>;
};
