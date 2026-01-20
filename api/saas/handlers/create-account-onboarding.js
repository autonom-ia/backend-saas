const { createAccount } = require('../services/account-service');
const { success, error: errorResponse } = require('../utils/response');
const {
  ParseRequestBodyHelper,
  ValidateOnboardingDataHelper,
  CreateDocumentParameterHelper,
  CreateInboxIfNeededHelper,
  CreateKnowledgeBaseParameterHelper,
  CreateStandardParametersHelper,
  RelateUserToAccountHelper,
} = require('./create-account-onboarding/helpers');

exports.handler = async (event) => {
  try {
    const parseResult = ParseRequestBodyHelper.execute(event);
    if (!parseResult.isValid) {
      return parseResult.response;
    }

    const body = parseResult.body;

    const validation = ValidateOnboardingDataHelper.execute(body);
    if (!validation.isValid) {
      return validation.response;
    }

    const { accountName, accountEmail, accountPhone, productId, parameters = {}, user_id, document } = body;

    const created = await createAccount({
      name: accountName,
      social_name: accountName,
      email: accountEmail,
      phone: accountPhone,
      product_id: productId,
      document,
    });

    const accountId = created.id;

    await CreateDocumentParameterHelper.execute(accountId, document);
    await CreateInboxIfNeededHelper.execute(accountId, accountPhone);
    await CreateKnowledgeBaseParameterHelper.execute(accountId, parameters);
    await CreateStandardParametersHelper.execute(accountId, parameters);
    await RelateUserToAccountHelper.execute(event, user_id, accountId);

    return success(
      {
        success: true,
        message: 'Conta criada com sucesso',
        data: {
          ...created,
          parametersCreated: true,
        },
      },
      201
    );
  } catch (error) {
    console.error('Erro ao criar conta (onboarding):', error);
    return errorResponse(
      {
        success: false,
        message: 'Erro ao criar conta',
        error: error.message,
      },
      500
    );
  }
};
