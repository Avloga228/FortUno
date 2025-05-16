import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./routes";
import "./App.css";
import { AuthProvider } from "./context/AuthContext";

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app">
      <AppRoutes />
        </div>
      </AuthProvider>
    </Router>
  );
}