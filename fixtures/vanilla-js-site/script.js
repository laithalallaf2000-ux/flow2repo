
const button = document.getElementById("myButton");

const title = document.getElementById("title");

button.addEventListener("click", function () {
  title.textContent = "You clicked the button!";
  title.style.color = "green";
});
