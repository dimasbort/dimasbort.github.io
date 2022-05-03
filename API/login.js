export const login = async (data) => {
  return fetch(
    "https://us-east-1.aws.webhooks.mongodb-realm.com/api/client/v2.0/app/application-1-xroue/service/users/incoming_webhook/login",
    {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    }
  ).then((response) => response.json());
};
