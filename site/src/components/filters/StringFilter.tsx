import { useContext, useState } from "react";
import type { FilterValue, STACQueryable } from "../../types";
import { Box, FormControl, InputLabel, MenuItem, Select, TextField, type SelectChangeEvent } from "@mui/material";
import { AppContext } from "../../AppContext";

/**
 * The properties required to populate the filter field for an integer type.
 *
 * @interface StringFilterProps
 * @typedef {StringFilterProps}
 */
interface StringFilterProps {
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
 * The Panel to enter filters for a string field.
 *
 * @param {string} props.collectionName
 * @param {FilterValue} props.filterData
 * @param {STACQueryable} props.queryable
 * @param {(collectionName: string, filterData: FilterValue) => void} props.updateFilterHandler
 * @returns {React.ElementType}
 */
const StringFilter: React.FC<StringFilterProps> = ({
    collectionName, 
    filterData, 
    queryable, 
    updateFilterHandler
}) => {
  const {t} = useContext(AppContext)!;
  const [localValue, setLocalValue] = useState<string>((filterData.value as string) ?? '');
  const [valid, setValid] = useState<boolean>(true);
  const [localOperation, setLocalOperation] = useState<string>(filterData.operation && filterData.operation != '' ? filterData.operation : '=');
  filterData.operation = localOperation;

   /**
   * Handler to handle what happens when a filter value is entered.
   * @param event 
   */
  const handleFilterValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setLocalValue(newValue);

    if(queryable.pattern) {
      // ^ and $ are needed to make sure the entire value matches pattern the and not just a substring matches
      const regEx = new RegExp('^'+queryable.pattern+'$', 'i');
      
      if(regEx.test(newValue) || newValue === '') {
        setValid(true);
        const newFilter: FilterValue = {...filterData, type: 'string', value: newValue};
        updateFilterHandler(collectionName, newFilter);
      }
      else {
        //TODO better validation (reset value to '' if invalid ?)
        setValid(false);
      }
    }
    else {
      const newFilter: FilterValue = {...filterData, type: 'string', value: newValue};
      updateFilterHandler(collectionName, newFilter);
    }
  };

  /**
   * Handler to handle what happens when a filter operation is updated.
   * @param event 
   */  
  const handleFilterOperationChange = (event: SelectChangeEvent) => {
    const newOperation = event.target.value;
    setLocalOperation(newOperation);

    const newFilter: FilterValue = {...filterData, type: 'string', operation: newOperation};
    updateFilterHandler(collectionName, newFilter);
  };

  /**
   * Handler to handle what happens when a filter value is selected.
   * @param event 
   */
  const handleFilterSelectValueChange = (event: SelectChangeEvent) => {
    const newValue = event.target.value;
    setLocalValue(newValue);

    const newFilter: FilterValue = {...filterData, type: 'string', value: newValue};
    updateFilterHandler(collectionName, newFilter);
  };

  if (queryable.enum) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', maxWidth:576 }}>
        <FormControl variant="outlined" size="small" sx={{ width: '75vw', maxWidth:566}}>
          <InputLabel shrink id="select-value-label">
            {t('value')}
          </InputLabel>
          <Select
            labelId="select-value-label"
            value={localValue}
            onChange={handleFilterSelectValueChange}
            label={t('value')}
            displayEmpty
          >
            <MenuItem key={'any'} value={''}>{t('any')}</MenuItem>
            {queryable.enum.map((choice) => (
              <MenuItem key={choice ?? 'empty'} value={choice ?? ''}>
                {choice}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 1, width: '75vw'}}>
      <FormControl variant="outlined" size="small" sx={{ width: '25vw', maxWidth:182 }}>
        <InputLabel shrink id="select-field-label">
          {t('operation')}
        </InputLabel>
        <Select
          labelId="select-field-label"
          value={localOperation}
          size="small"
          onChange={handleFilterOperationChange}
          label={t('operation')}
        >
          {<MenuItem value="=">{'='}</MenuItem>}
          {<MenuItem value="LIKE">{t('like')}</MenuItem>}
        </Select>
      </FormControl>

      <TextField
        size="small"
        label={t('value')}
        variant="outlined"
        value={localValue}
        onChange={handleFilterValueChange}
        placeholder={t('stringPlaceholder')}
        color={valid ? 'primary' : 'warning'}
        sx={{ width: '50vw', maxWidth: 374}}
      />
    </Box>
  );    
}

export default StringFilter;