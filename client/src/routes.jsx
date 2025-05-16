import React from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import RoomPage from "./pages/RoomPage";
import WaitingRoom from "./pages/WaitingRoom";

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/room/:roomId" element={<RoomPage />} />
    <Route path="/waiting/:roomId" element={<WaitingRoom />} />
    <Route path="*" element={<HomePage />} />
  </Routes>
);

export default AppRoutes; 