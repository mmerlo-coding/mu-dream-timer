# MU DREAM Boss Tracker (Discord Bot)

Bot de Discord **solo con botones** para trackear 14 bosses de MU DREAM en servidores Main 1, 2 y 3.

## Cómo funciona

1. **Panel fijo** en tu canal: eliges un boss → pulsas **Murió S1 / S2 / S3**
2. Arranca el timer según las horas de respawn del boss
3. **5 minutos antes** del respawn: aviso con **imagen grande** + botones **☠️ Murió S1/S2/S3**
4. Al matarlo, pulsas el botón → se reinicia el ciclo

Sin comandos `/`. Todo es click.

---

## Importante sobre hosting

Discord **no puede ejecutar bots dentro de la app**. Para avisos automáticos, el bot debe estar online en algún servidor (Render, Railway, etc.).

**No necesitas `npm start` en tu PC** — despliegas una vez en la nube y olvidas.

---

## Configuración (una sola vez)

### 1. Variables de entorno

Copia `.env.example` → `.env`:

```env
DISCORD_TOKEN=tu_token
DISCORD_CLIENT_ID=tu_application_id
DISCORD_GUILD_ID=id_de_tu_servidor
NOTIFY_CHANNEL_ID=id_canal_avisos
DASHBOARD_CHANNEL_ID=id_canal_panel
```

- **`DASHBOARD_CHANNEL_ID`** — panel con botones (queda fijado arriba). Ej: `#timers`
- **`NOTIFY_CHANNEL_ID`** — avisos 5 min antes del respawn. Ej: `#avisos-bosses`
- Si omites `DASHBOARD_CHANNEL_ID`, panel y avisos van al mismo canal.

**Cómo obtener IDs:** Modo desarrollador activado → clic derecho en servidor/canal → Copiar ID.

### 2. Invitar el bot

[Developer Portal](https://discord.com/developers/applications) → OAuth2 → URL Generator:

- Scopes: `bot`
- Permisos: Send Messages, Embed Links, Attach Files, Read Message History, **Pin Messages** (fijar panel)

### 3. Desplegar en Render (gratis para empezar)

1. Sube el repo a GitHub
2. [render.com](https://render.com) → New → **Background Worker**
3. Conecta el repo
4. Render detectará `render.yaml`
5. Añade las 4 variables de entorno
6. Deploy

Al arrancar, el bot publica solo el **panel de timers** en `NOTIFY_CHANNEL_ID`.

---

## Uso diario (solo botones)

### Panel principal
- Menú desplegable → elige boss
- **Murió S1 / Murió S2 / Murió S3** → inicia timer para ese servidor MU

### Avisos automáticos
- 5 min antes: mensaje con imagen del boss
- Botones **☠️ Murió S1/S2/S3** debajo de la imagen
- Click → nuevo timer → ciclo se repite

---

## Bosses incluidos (14)

Muggron, Kharzul, Vescrya, Borgar, Héroe Explorador, Héroe Hombre Lobo, Goblin Azul/Rojo/Amarillo, Dragón Rojo, Abbadon, Lord of Kundun (×2), Señor Supremo Infernal.

---

## Desarrollo local (opcional)

```bash
npm install
npm run crop-images
npm start
```

Los datos se guardan en `data/timers-bot.db`.
