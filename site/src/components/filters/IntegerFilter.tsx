import { Box, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useState, useContext } from 'react';
import type { STACQueryable, FilterValue } from '../../types';
import { AppContext } from '../../AppContext';

/**
 * The properties required to populate the filter field for an integer type.
 *
 * @interface IntegerFilterProps
 * @typedef {IntegerFilterProps}
 */
interface IntegerFilterProps {
    /**
     * The name of the collection the filter belongs to.
     *
     * @type {string}
     */ 
    collectionName: string;
    /**
     * The data for the filter.
     *
     * @type {FilterValue}
     */        
    filterData: FilterValue;
    /**
     * The STAC queryable field.
     *
     * @type {STACQueryable}
     */        
    queryable: STACQueryable;
    /**
     * A handler to handle what happens when a filter is updated.
     *
     * @type {(collectionName: string, filterData: FilterValue) => void}
     */ 
    updateFilterHandler: (collectionName: string, filterData: FilterValue) => void;
}

/**
 * The Panel to enter filters for an integer field.
 *
 * @param {string} props.collectionName
 * @param {FilterValue} props.filterData
 * @param {STACQueryable} props.queryable
 * @param {(collectionName: string, filterData: FilterValue) => void} props.updateFilterHandler
 * @returns {React.ElementType}
 */
const IntegerFilter: React.FC<IntegerFilterProps> = ({
  collectionName,
  filterData,
  queryable,
  updateFilterHandler,
}) => {
  const {t} = useContext(AppContext)!;
  const [localValue, setLocalValue] = useState<string>((filterData.value as string) ?? '');
  const [valid, setValid] = useState<boolean>(true);
  const [localOperation, setLocalOperation] = useState<string>(filterData.operation && filterData.operation != '' ? filterData.operation : '=');
  filterData.operation = localOperation;
  const minimum = queryable.minimum ? queryable.minimum : -Infinity;
  const maximum = queryable.maximum ? queryable.maximum: Infinity;

  /**
   * Handler to handle what happens when a filter value is entered.
   * @param event 
   */
  const handleFilterValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = event.target.value;

    if(newValue === "") {
      setLocalValue(newValue);
      setValid(true);
    }
    else if (/^[+-]?\d+$/.test(newValue)) {
      if(+newValue < minimum) {
        newValue = minimum.toString(10);
      }
      else if(+newValue > maximum) {
        newValue = maximum.toString(10);
      }
      
      setLocalValue(newValue);
      setValid(true);
    }
    else {
      setValid(false);
    }

    const newFilter: FilterValue = {...filterData, type: 'number', value: +newValue};
    updateFilterHandler(collectionName, newFilter);
  };

  /**
   * Handler to handle what happens when a filter operation is updated.
   * @param event 
   */
  const handleFilterOperationChange = (event: SelectChangeEvent) => {
      const newOperation = event.target.value;
      setLocalOperation(newOperation);

      const newFilter: FilterValue = {...filterData, type: 'number', operation: newOperation};
      updateFilterHandler(collectionName, newFilter);      
  };

  /**
   * Handler to handle what happens when a filter value is selected.
   * @param event 
   */
  const handleFilterSelectValueChange = (event: SelectChangeEvent) => {
      const newValue = event.target.value;
      setLocalValue(newValue);

      const newFilter: FilterValue = {...filterData, type: 'number', value: newValue};
      updateFilterHandler(collectionName, newFilter);
  };

  if (queryable.enum) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 1, maxWidth:576 }}>
        <FormControl variant="outlined" sx={{ width: '75vw', maxWidth:566 }}>
          <InputLabel shrink id="select-value-label">
            {t('value')}
          </InputLabel>
          <Select
            labelId="select-field-label"
            value={localValue}
            onChange={handleFilterSelectValueChange}
            label={t('value')}
          >
            <MenuItem key={'any'} value={''}>{t('any')}</MenuItem>
            {queryable.enum.map((choice) => (
              <MenuItem key={choice ?? 'empty'} value={choice ?? ''}>{choice}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 1, width: '75vw' }}>
      <FormControl variant="outlined" size="small" sx={{ width: '25vw', maxWidth:182 }}>
        <InputLabel shrink id="select-field-label">
          {t('operation')}
        </InputLabel>
        <Select
          labelId="select-field-label"
          value={localOperation}
          onChange={handleFilterOperationChange}
          label={t('operation')}
        >
          {<MenuItem value="=">{'='}</MenuItem>}
          {<MenuItem value="<">{'<'}</MenuItem>}
          {<MenuItem value=">">{'>'}</MenuItem>}
          {<MenuItem value="<=">{'<='}</MenuItem>}
          {<MenuItem value=">=">{'>='}</MenuItem>}
          {<MenuItem value="<>">{'<>'}</MenuItem>}
          {<MenuItem value="between">{t('between')}</MenuItem>}
        </Select>
      </FormControl>
      <TextField
        size="small"
        label={t('value')}
        variant="outlined"
        value={localValue}
        slotProps={{ htmlInput: {min: minimum,  max: maximum} }}
        onChange={handleFilterValueChange}
        placeholder={t('numberPlaceholder')}
        color={valid ? 'primary' : 'warning'}
        sx={{ width: '50vw', maxWidth: 374}}
      />
    </Box>
  );
};

export default IntegerFilter;