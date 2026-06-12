## Kubernetes Deployment (Self-Hosted)

### Prerequisites

- A running Kubernetes cluster (k3s, minikube, kubeadm, or any self-hosted setup)
- `kubectl` configured and pointing at your cluster
- Docker installed on your build machine

---

### Step 1 — Build Docker Images

```bash
# Build backend image
docker build -f k8s/backend.Dockerfile -t ollive-backend:latest ./backend

# Build frontend image
# Copy nginx.conf into frontend directory first
cp k8s/nginx.conf ./frontend/nginx.conf
docker build -f k8s/frontend.Dockerfile -t ollive-frontend:latest ./frontend
```

If your cluster can't pull local images, push to a registry first:
```bash
docker tag ollive-backend:latest <your-registry>/ollive-backend:latest
docker push <your-registry>/ollive-backend:latest
# update image: field in backend-deployment.yaml accordingly
```

---

### Step 2 — Create Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

---

### Step 3 — Create Secrets

```bash
kubectl create secret generic ollive-secrets \
  --from-literal=GEMINI_API_KEY=AIza... \
  --from-literal=OPENAI_API_KEY=sk-... \
  -n ollive
```

---

### Step 4 — Deploy Everything

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/sqlite-pvc.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

Or all at once:
```bash
kubectl apply -f k8s/ --namespace=ollive
```

---

### Step 5 — Verify

```bash
kubectl get all -n ollive
```

Expected output:
```
NAME                                    READY   STATUS    RESTARTS
pod/ollive-backend-xxx                  1/1     Running   0
pod/ollive-frontend-xxx                 1/1     Running   0

NAME                       TYPE        CLUSTER-IP     PORT(S)
service/ollive-backend     ClusterIP   10.96.x.x      3001/TCP
service/ollive-frontend    ClusterIP   10.96.x.x      5173/TCP

NAME                               READY   UP-TO-DATE
deployment.apps/ollive-backend     1/1     1
deployment.apps/ollive-frontend    2/2     2
```

---

### Step 6 — Access the App

Add to `/etc/hosts` (local cluster):
```
127.0.0.1  ollive.local
```

Then open: **http://ollive.local**

For minikube:
```bash
minikube tunnel
# then open http://ollive.local
```

---

### Architecture Notes

| Decision | Reason |
|---|---|
| `replicas: 1` for backend | SQLite uses `ReadWriteOnce` PVC — only one pod can write at a time |
| `strategy: Recreate` for backend | Prevents two pods mounting the same PVC simultaneously |
| `replicas: 2` for frontend | Stateless — safe to scale, gives zero-downtime deploys |
| SSE annotations on Ingress | Disables nginx buffering so streaming tokens reach the browser in real time |
| `proxy-read-timeout: 3600` | Prevents nginx killing long-running SSE connections mid-stream |

---

### Scaling to Production

To move beyond SQLite, swap the backend for Postgres:

```yaml
# add to backend-deployment.yaml env:
- name: DATABASE_URL
  value: "postgresql://user:pass@postgres-service:5432/ollive"
```

Then backend replicas can scale freely:
```bash
kubectl scale deployment ollive-backend --replicas=3 -n ollive
```
