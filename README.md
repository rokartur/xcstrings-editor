# xcstrings-editor

Web editor for `.xcstrings` localization files with optional local AI translation via Ollama.

## Ollama from hosted domain (important)

If you open the app from a hosted URL (for example `https://xcstrings.ovh/`) and try to call local Ollama (`127.0.0.1:11434`), Ollama may reject requests because of CORS (403 / `ERR_BLOCKED_BY_CLIENT` in browser console).

By default, Ollama only allows local browser origins.  
You must allow your hosted app origin using `OLLAMA_ORIGINS`.

### macOS

```bash
launchctl setenv OLLAMA_ORIGINS "https://xcstrings.ovh,http://127.0.0.1:11434"
```

Then fully quit and restart Ollama.

If you run Ollama manually from terminal (`ollama serve`), `launchctl setenv` does not affect the already running process.  
Stop the current process and start it with env inline:

```bash
env OLLAMA_ORIGINS="https://xcstrings.ovh,http://127.0.0.1:11434" ollama serve
```

Common pitfall: if `curl` still returns `403`, you are usually hitting an old `ollama serve` process started without `OLLAMA_ORIGINS`.

### Linux (systemd)

```bash
sudo systemctl edit ollama.service
```

Add:

```ini
[Service]
Environment="OLLAMA_ORIGINS=https://xcstrings.ovh,http://127.0.0.1:11434"
```

Apply:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### Windows

Set user environment variable:

- Name: `OLLAMA_ORIGINS`
- Value: `https://xcstrings.ovh,http://127.0.0.1:11434`

Then restart Ollama.

### Verify

```bash
curl -i -H "Origin: https://xcstrings.ovh" http://127.0.0.1:11434/api/tags
```

Expected: `HTTP/1.1 200 OK` (not `403`).

### App setting

In AI settings, use:

`http://127.0.0.1:11434`
