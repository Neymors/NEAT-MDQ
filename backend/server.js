const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// ==========================================================================
// --- VALIDACIÓN ESTRICTA DE ENTORNO (Rule: Production-Grade Hardening) ---
// ==========================================================================
// El estado por defecto debe ser el más seguro. Si no existe la clave, el 
// sistema falla de inmediato (Fail-Fast) antes de quedar expuesto.
if (!process.env.API_KEY) {
    console.error("\x1b[31m%s\x1b[0m", "CRITICAL SECURITY ERROR: 'API_KEY' no está definida en el entorno (.env).");
    console.error("\x1b[33m%s\x1b[0m", "El servidor se ha detenido por seguridad para evitar comportamientos indefinidos.");
    process.exit(1); 
}

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. SEGURIDAD DE HEADERS (Secure by Default) ---
// Helmet configura headers HTTP para prevenir vectores de ataque comunes (Clickjacking, XSS, etc.)
app.use(helmet());

// --- 2. CONFIGURACIÓN DE CORS (Principio de Menor Privilegio) ---
// Restringimos estrictamente el acceso a tus orígenes de desarrollo local
const corsOptions = {
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500'], 
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());

// --- 3. RATE LIMITING (Protección de Recursos / Mitigación DoS) ---
// Limita el abuso de clientes automatizados o scripts maliciosos
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Máximo 100 peticiones por ventana por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas peticiones. Por favor, intenta más tarde." }
});

// --- 4. RUTA PROXY DEL CLIMA (Zero-Trust & Input Validation) ---
app.get('/api/clima', apiLimiter, async (req, res) => {
    const { ciudad } = req.query;
    
    // A. VALIDACIÓN EN SERVIDOR (Assume All Input Is Malicious)
    // El cliente solo maneja UX. El servidor sanitiza y evalúa la entrada de forma aislada.
    const cleanCity = ciudad ? ciudad.trim() : "";
    
    if (!cleanCity) {
        return res.status(400).json({ error: "El nombre de la ciudad es requerido." });
    }

    try {
        const apiKey = process.env.API_KEY;
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cleanCity)}&appid=${apiKey}&units=metric&lang=es`;
        
        const respuesta = await axios.get(url);
        const data = respuesta.data;

        // D. ESTRUCTURA DE SALIDA SEGURA (Normalization / Minimización de Superficie)
        // Reducimos el payload original de OpenWeather a lo estrictamente necesario para el frontend.
        res.json({
            nombre: data.name,
            temp: Math.round(data.main.temp),
            desc: data.weather[0].description,
            icon: data.weather[0].icon,
            humedad: data.main.humidity,
            viento: data.wind.speed
        });

    } catch (error) {
        // E. ERROR HANDLING NO REVELADOR (Sanitized & Non-revealing)
        // Guardamos el Log técnico detallado con stack traces únicamente de forma interna en la terminal.
        console.error(`[ERROR] Petición fallida para la ciudad "${cleanCity}":`, error.message);

        if (error.response) {
            const status = error.response.status;
            // Ofrecemos respuestas genéricas controladas para no filtrar datos del proveedor upstream.
            const publicMessage = status === 404 ? "Ciudad no encontrada." : "Servicio de clima temporalmente fuera de línea.";
            return res.status(status).json({ error: publicMessage });
        }

        // Error interno por defecto encapsulado
        res.status(500).json({ error: "Error de conexión interna." });
    }
});

// INICIO DEL SERVIDOR
app.listen(PORT, () => {
    console.log(`\x1b[32m%s\x1b[0m`, `[SYSTEM] NEAT MDQ Core Engine iniciado de manera segura en el puerto ${PORT}`);
});