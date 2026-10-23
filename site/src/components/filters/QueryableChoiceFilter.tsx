import { useContext } from "react";
import { Box, FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from "@mui/material";
import { AppContext } from "../../AppContext";
import type { FilterValue, STACQueryable } from "../../types";
import { getQueryableChoices } from "../../utils/QueryableFilterUtils";

interface QueryableChoiceFilterProps {
  collectionName: string;
  filterData: FilterValue;
  queryable: STACQueryable;
  updateFilterHandler: (collectionName: string, filterData: FilterValue) => void;
}

const getQueryableType = (queryable: STACQueryable): string | undefined =>
  Array.isArray(queryable.type)
    ? queryable.type.find(typeName => typeName !== "null")
    : queryable.type ?? undefined;

const QueryableChoiceFilter: React.FC<QueryableChoiceFilterProps> = ({
  collectionName,
  filterData,
  queryable,
  updateFilterHandler,
}) => {
  const { t } = useContext(AppContext)!;
  const choices = getQueryableChoices(queryable) ?? (
    getQueryableType(queryable) === "boolean" ? [true, false] : []
  );
  const selectedIndex = choices.findIndex(choice => Object.is(choice, filterData.value));
  const queryableType = getQueryableType(queryable);
  const filterType = queryableType === "integer" || queryableType === "number"
    ? "number"
    : queryableType === "boolean" ? "boolean" : "string";

  const handleChange = (event: SelectChangeEvent) => {
    const selection = event.target.value;
    const choiceIndex = selection === "" ? -1 : Number(selection);
    const choice = Number.isInteger(choiceIndex) && choiceIndex >= 0 ? choices[choiceIndex] : undefined;
    updateFilterHandler(collectionName, {
      ...filterData,
      type: filterType,
      operation: choice === undefined ? undefined : choice === null ? "IS NULL" : "=",
      value: choice,
    });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "row", alignItems: "flex-end", maxWidth: 576 }}>
      <FormControl variant="outlined" size="small" sx={{ width: "75vw", maxWidth: 566 }}>
        <InputLabel shrink id={`${filterData.id}-choice-label`}>{queryable.title || filterData.fieldKey}</InputLabel>
        <Select
          labelId={`${filterData.id}-choice-label`}
          value={selectedIndex < 0 ? "" : String(selectedIndex)}
          onChange={handleChange}
          label={queryable.title || filterData.fieldKey}
          displayEmpty
        >
          <MenuItem value="">{t("any")}</MenuItem>
          {choices.map((choice, index) => (
            <MenuItem key={`${filterData.id}-choice-${index}`} value={String(index)}>
              {typeof choice === "boolean"
                ? t(choice ? "trueValue" : "falseValue")
                : choice === null ? t("nullValue") : String(choice)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default QueryableChoiceFilter;