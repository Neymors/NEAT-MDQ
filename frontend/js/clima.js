/**
 * NEAT MDQ - Módulo de Clima Robusto
 * Implementando: Zero Trust & UX Validation
 */

// 1. CONFIGURACIÓN DINÁMICA DE URL
// Detecta si estamos en local o en producción
const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api/clima"
    : "https://tu-backend-desplegado.com/api/clima"; // Cambiar al desplegar

const AUTO_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutos
let autoRefreshTimer = null;

// Elementos del DOM
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const weatherDisplay = document.getElementById('weather-display');
const weatherStatus = document.getElementById('weather-status');
const tempElement = document.getElementById('temp');
const cityNameElement = document.getElementById('city-name');
const descElement = document.getElementById('description');
const iconElement = document.getElementById('weather-icon');

/**
 * Función principal para obtener el clima
 * Aplica validación previa (UX) y manejo de errores sanitizado
 */
async function fetchWeather(city) {
    // A. VALIDACIÓN DE UX (Assume All Input Is Malicious)
    const cleanCity = city ? city.trim() : "";
    
    if (!cleanCity) {
        showWeatherError("Por favor, ingresa una ciudad.");
        return;
    }

    if (cleanCity.length < 3) {
        showWeatherError("Nombre demasiado corto.");
        return;
    }

    // B. ESTADO VISUAL DE CARGA
    weatherStatus.textContent = "Sincronizando con satélite...";
    weatherStatus.classList.remove('hidden', 'text-red-500');
    weatherDisplay.classList.add('hidden');

    try {
        // C. PETICIÓN AL PROXY (Protección de API Key)
        const url = `${BACKEND_URL}?ciudad=${encodeURIComponent(cleanCity)}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            // Manejo de errores mapeados por el backend (Non-revealing)
            throw new Error(data.error || "Error en la conexión.");
        }

        // D. ACTUALIZACIÓN DEL DOM SEGURA (Evita XSS)
        updateWeatherUI(data);
        
        // E. PERSISTENCIA Y AUTOMATIZACIÓN
        localStorage.setItem('lastWeatherCity', data.nombre);
        resetAutoRefreshTimer(data.nombre);

    } catch (error) {
        console.error("[DEBUG] Detalle técnico oculto al usuario:", error.message);
        showWeatherError(error.message === "Failed to fetch" 
            ? "Servidor fuera de línea" 
            : error.message);
    }
}

/**
 * Actualiza la interfaz con datos sanitizados
 */
function updateWeatherUI(data) {
    weatherStatus.classList.add('hidden');
    weatherDisplay.classList.remove('hidden');

    // Usamos textContent para prevenir inyección de scripts desde el JSON
    cityNameElement.textContent = data.nombre;
    tempElement.textContent = `${data.temp}°`;
    descElement.textContent = data.desc.charAt(0).toUpperCase() + data.desc.slice(1);
    
    // Icono seguro
    if (data.icon) {
        iconElement.src = `https://openweathermap.org/img/wn/${data.icon}@2x.png`;
        iconElement.alt = data.desc;
    }

    // Actualizar timestamp
    updateTimestamp();

    // Disparar animación visual (si existe en script.js)
    if (typeof updateWeatherEffects === 'function') {
        updateWeatherEffects(data.desc);
    }
}

/**
 * Muestra errores de forma estética y segura
 */
function showWeatherError(message) {
    weatherStatus.textContent = message;
    weatherStatus.classList.remove('hidden');
    weatherStatus.classList.add('text-red-500');
    weatherDisplay.classList.add('hidden');
}

/**
 * Gestión de marca de tiempo (Timestamp)
 */
function updateTimestamp() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let timestampEl = document.getElementById('weather-updated-at');
    
    if (!timestampEl) {
        timestampEl = document.createElement('p');
        timestampEl.id = 'weather-updated-at';
        timestampEl.className = 'text-[10px] text-muted uppercase tracking-widest mt-4 opacity-50';
        weatherDisplay.appendChild(timestampEl);
    }
    timestampEl.textContent = `Actualizado ${timeStr}`;
}

/**
 * Timer de Auto-refresh (Efficiency & Resilience)
 */
function resetAutoRefreshTimer(city) {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    
    autoRefreshTimer = setInterval(() => {
        // Solo refresca si la pestaña está activa para ahorrar recursos
        if (!document.hidden) {
            fetchWeather(city);
        }
    }, AUTO_REFRESH_INTERVAL);
}

// --- EVENTOS ---

if (searchBtn) {
    searchBtn.addEventListener('click', () => fetchWeather(cityInput.value));
}

if (cityInput) {
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchWeather(cityInput.value);
    });
}

// Carga inicial (Graceful Degradation)
window.addEventListener('DOMContentLoaded', () => {
    const savedCity = localStorage.getItem('lastWeatherCity') || "Mar del Plata";
    fetchWeather(savedCity);
});