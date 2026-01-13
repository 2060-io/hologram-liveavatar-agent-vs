# LiveAvatar Agent Helm Chart

This Helm chart deploys the LiveAvatar Agent for Hologram, an AI-powered video avatar using HeyGen's LiveAvatar SDK.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.2.0+
- HeyGen LiveAvatar API credentials

## Installation

```bash
# Add credentials to Kubernetes secret
kubectl create secret generic liveavatar-secrets \
  --from-literal=LIVEAVATAR_API_KEY=your-api-key \
  --from-literal=LIVEAVATAR_AVATAR_ID=your-avatar-id \
  --from-literal=LIVEAVATAR_VOICE_ID=your-voice-id \
  --from-literal=LIVEAVATAR_CONTEXT_ID=your-context-id

# Install with existing secret
helm install liveavatar-agent oci://docker.io/io2060/hologram-liveavatar-agent-chart \
  --set existingSecret=liveavatar-secrets
```

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `name` | Application name | `liveavatar-agent-app` |
| `replicas` | Number of replicas | `1` |
| `containerPort` | Container port | `4001` |
| `image.pullPolicy` | Image pull policy | `Always` |
| `secrets.liveavatarApiKey` | HeyGen API key | `""` |
| `secrets.liveavatarAvatarId` | Avatar ID | `""` |
| `secrets.liveavatarVoiceId` | Voice ID | `""` |
| `secrets.liveavatarContextId` | Context ID | `""` |
| `vs-agent-chart.enabled` | Enable VS Agent sidecar | `true` |

## VS Agent Integration

This chart includes VS Agent as a dependency for DIDComm/Hologram integration. The VS Agent handles secure, decentralized messaging while the LiveAvatar Agent handles the video avatar functionality.
