const form = document.getElementById("authorization-form");
const inputName = document.getElementById("name");
const inputPassword = document.getElementById("password");
const inputConfirmPassword = document.getElementById("confirmed-password");
const submitBtn = document.getElementById("submit-btn");

const emptyFieldsMessage = document.createElement("div");
emptyFieldsMessage.innerHTML =
  '<div id="emptyField" style="color: red; text-align: center;">Error: empty fields</div>';
const NotsamePasswordsMessage = document.createElement("div");
NotsamePasswordsMessage.innerHTML =
  '<div id="incorrectPasswords" style="color: red; text-align: center;">Error: Passwords must be same</div>';

const successfullyRegistered = document.createElement("div");
successfullyRegistered.innerHTML =
  '<div id="registered" style="color: green; text-align: center;">You successfully registered</div>';

const serverError = document.createElement("div");
serverError.innerHTML =
  '<div id="incorrectPasswords" style="color: red; text-align: center;">something went wrong</div>';

form.onsubmit = async (e) => {
  e.preventDefault();

  const { elements } = document.forms["authorization-form"];

  if (
    !(
      elements.name.value &&
      elements.password.value &&
      elements.confirmedPassword.value
    )
  ) {
    form.insertBefore(emptyFieldsMessage, submitBtn);
    return;
  }

  if (elements.password.value !== elements.confirmedPassword.value) {
    form.insertBefore(NotsamePasswordsMessage, submitBtn);
    return;
  }

  const data = {
    name: elements.name.value,
    password: elements.password.value,
  };

  const response = await fetch(
    "https://us-east-1.aws.webhooks.mongodb-realm.com/api/client/v2.0/app/application-1-xroue/service/register/incoming_webhook/register",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );

  console.log("response", response);

  if (response.status === 200) {
    form.insertBefore(successfullyRegistered, submitBtn);
    return;
  }

  form.insertBefore(serverError, submitBtn);
};

const onFocusHandler = () => {
  document.getElementById("emptyField") && form.removeChild(emptyFieldsMessage);
  document.getElementById("incorrectPasswords") &&
    form.removeChild(NotsamePasswordsMessage);
};

inputName.onfocus = onFocusHandler;
inputPassword.onfocus = onFocusHandler;
inputConfirmPassword.onfocus = onFocusHandler;
