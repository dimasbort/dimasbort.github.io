export const register = async (data) => {
  return fetch(
    "https://us-east-1.aws.webhooks.mongodb-realm.com/api/client/v2.0/app/application-1-xroue/service/register/incoming_webhook/register",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};
