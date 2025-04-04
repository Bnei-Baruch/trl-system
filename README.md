
# TRL-System

A translation system with multiple applications including MqttMerkaz, MqttClient, HttpClient, MqttAdmin, HttpAdmin, TrlChat, and more.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install development dependencies:
```bash
npm install --save-dev cross-env
```

## Available Applications

The system includes several applications that can be built and run independently:

- **MqttMerkaz** - Default translation application
- **MqttClient** - MQTT client application
- **HttpClient** - HTTP client application
- **MqttAdmin** - MQTT admin interface
- **HttpAdmin** - HTTP admin interface
- **TrlChat** - Translation chat application
- **WeMain** - WeMain application
- **WeClient** - WeClient application
- **WeHttpStream** - WebRTC HTTP stream application

## Development

You can run any of the applications in development mode using:

```bash
# Run the default application (MqttMerkaz)
npm start

# Run a specific application
npm run start:merkaz
npm run start:mqttclient
npm run start:httpclient
npm run start:mqttadmin
npm run start:httpadmin
npm run start:trlchat
npm run start:wemain
npm run start:weclient
npm run start:wehttpstream
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Building for Production

Build any application for production using:

```bash
# Build the default application (MqttMerkaz)
npm run build

# Build a specific application
npm run build:merkaz
npm run build:mqttclient
npm run build:httpclient
npm run build:mqttadmin
npm run build:httpadmin
npm run build:trlchat
npm run build:wemain
npm run build:weclient
npm run build:wehttpstream
```

The build output will be in the `build` directory.

## How It Works

The application selection system works by:

1. Passing the `REACT_APP_TARGET` environment variable during build/runtime
2. Using conditional rendering in the main App component to render only the selected application
3. No need to manually comment/uncomment imports in the source code

## Troubleshooting

If you encounter dependency warnings or errors during installation, you can use:

```bash
npm install --legacy-peer-deps
```

