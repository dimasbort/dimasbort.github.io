import { login } from "../API/login.js";

const form = document.getElementById("authorization-form");
const inputName = document.getElementById("name");
const inputPassword = document.getElementById("password");

const errorMessage = document.createElement("div");
errorMessage.innerHTML =
  '<div style="color: red; text-align: center;">Error: empty fields</div>';

const notAuthorized = document.createElement("div");
notAuthorized.innerHTML =
  '<div style="color: red; text-align: center;">No such users</div>';

form.onsubmit = async (e) => {
  e.preventDefault();

  const { elements } = document.forms["authorization-form"];
  const submitBtn = document.getElementById("submit-btn");

  if (!(elements.name.value && elements.password.value)) {
    form.insertBefore(errorMessage, submitBtn);
    return;
  }

  const data = {
    name: elements.name.value,
    password: elements.password.value,
  };
  
  const user = await login(data);

  if (user) {
    window.location.href = "../index.html";
    return;
  }

  form.insertBefore(notAuthorized, submitBtn);
};

const onFocusHandler = () => {
  form.removeChild(errorMessage);
};

inputName.onfocus = onFocusHandler;
inputPassword.onfocus = onFocusHandler;
