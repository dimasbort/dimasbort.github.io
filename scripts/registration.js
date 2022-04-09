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

form.onsubmit = (e) => {
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

  alert(
    `Email ${elements.name.value} \nPassword ${elements.password.value}\nConfirm password ${elements.confirmedPassword.value}`
  );
  window.location.href = "../index.html";
};

const onFocusHandler = () => {
  document.getElementById("emptyField") && form.removeChild(emptyFieldsMessage);
  document.getElementById("incorrectPasswords") &&
    form.removeChild(NotsamePasswordsMessage);
};

inputName.onfocus = onFocusHandler;
inputPassword.onfocus = onFocusHandler;
inputConfirmPassword.onfocus = onFocusHandler;
