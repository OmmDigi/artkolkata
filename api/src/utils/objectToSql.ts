export const objectToSqlInsert = (data: object, paramsNumber = 1) => {
  let columns = "(";
  let fildValuesNumber = "(";
  const values: string[] = [];
  let number = paramsNumber;

  Object.entries(data).forEach(([key, value], index) => {
    if (index === 0) {
      columns += `${key}`;
      fildValuesNumber += `$${number}`;
    } else {
      columns += `, ${key}`;
      fildValuesNumber += `, $${number}`;
    }

    number++;
    values.push(value);
  });

  columns += ")";
  fildValuesNumber += ")";

  return {
    columns,
    params: fildValuesNumber,
    values,
    currentParamNumber: number,
  };
};

export const objectToSqlConverterUpdate = (data: object) => {
  let paramsNumber = 1;
  let fildes = "";
  const fildValues: string[] = [];

  Object.entries(data).forEach(([key, value], index) => {
    if (index === 0) {
      fildes += `${key} = $${paramsNumber}`;
    } else {
      fildes += `, ${key} = $${paramsNumber}`;
    }

    fildValues.push(value);
    paramsNumber++;
  });

  return {
    keys: fildes,
    values: fildValues,
    paramsNum: paramsNumber,
  };
};
