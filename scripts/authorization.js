const form = document.getElementById("authorization-form");
const inputName = document.getElementById("name");
const inputPassword = document.getElementById("password");

const errorMessage = document.createElement("div");
errorMessage.innerHTML =
  '<div style="color: red; text-align: center;">Error: empty fields</div>';

form.onsubmit = (e) => {
  e.preventDefault();

  const { elements } = document.forms["authorization-form"];

  if (!(elements.name.value && elements.password.value)) {
    const submitBtn = document.getElementById("submit-btn");

    form.insertBefore(errorMessage, submitBtn);
    return;
  }

  alert(`email ${elements.name.value} \npassword ${elements.password.value}`);
  window.location.href = "../index.html";
};

const onFocusHandler = () => {
  form.removeChild(errorMessage);
};

inputName.onfocus = onFocusHandler;
inputPassword.onfocus = onFocusHandler;
