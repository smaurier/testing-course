// app.js — LE FRONT (vanilla, aucune build step). Donné.
const form = document.getElementById("invitation-form");
const resultat = document.getElementById("resultat");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("email").value;
  const reponse = await fetch("/api/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await reponse.json();
  resultat.textContent = data.ok
    ? `Invitation envoyée à ${email}.`
    : `Refusé : ${data.reason}.`;
});
