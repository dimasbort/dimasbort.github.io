// import { variable } from "../API/login";

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

  // console.log("var", variable);
  // console.log("var");

  // const user = await login(data);

  // if (user) {
  //   window.location.href = "../index.html";
  //   return;
  // }

  // form.insertBefore(notAuthorized, submitBtn);
console.log(data)
  fetch(
    "https://us-east-1.aws.webhooks.mongodb-realm.com/api/client/v2.0/app/application-1-xroue/service/users/incoming_webhook/login",
    {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    }
  )
    .then((response) => response.json())
    .then((json) => {
      if (json) {
        window.location.href = "../index.html";
        return;
      }

      form.insertBefore(notAuthorized, submitBtn);
    });
};

const onFocusHandler = () => {
  form.removeChild(errorMessage);
};

inputName.onfocus = onFocusHandler;
inputPassword.onfocus = onFocusHandler;
