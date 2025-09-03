// API de catálogo (Apps Script doGet)
export const PRODUCTS_API = "https://script.google.com/macros/s/AKfycbx_x12R22dCHsNDRnfnMpmRWRaNeoW5s6KQfAncZbv4NyoNz5__VIUquc_6x5snfEB_/exec";

// API de pedidos (Apps Script doPost) — reemplaza con tu URL real de despliegue "exec"
export const ORDERS_API = "https://script.google.com/macros/s/AKfycbwXzUzgiqwH-jIc6SKsPkSkBYb7JOzSvqGm0vlbqob-Zkjev8HP8iXugQJ9-ajyg26Odg/exec"; // Hoja: pedidos_pagos

// Redirección después del pago
export const REDIRECT_URL = location.origin + "/gracias.html";
