import React from "react";
import { createRoot } from "react-dom/client";
import App from "./desktop/App.jsx";
import "./desktop/global.css";

// Monta a aplicação React no elemento raiz definido pelo HTML.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
