/**
 * Formata parâmetros de array para objeto
 * Converte array de objetos [{ name, value }] em um objeto { name: value }
 *
 * @param {Array} parametersArray - Array de parâmetros no formato [{ name, value }]
 * @returns {Object} - Objeto formatado { name1: value1, name2: value2, ... }
 */
const formatParameters = (parametersArray) => {
  const params = {};
  if (Array.isArray(parametersArray)) {
    parametersArray.forEach(param => {
      if(param.name && param.value !== undefined){
        params[param.name] = param.value;
      }
    });
  }
  return params;
};

module.exports = {
  formatParameters
};
