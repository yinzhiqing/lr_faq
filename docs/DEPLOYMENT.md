# 产品知识库 — Docker 部署手册（新手向）

本手册假设你在一台 **Linux 服务器**（或本地电脑）上部署，且对 Docker 不太熟悉。按顺序做即可。

---

## 1. Docker 是什么？和本系统的关系

- **镜像（Image）**：像「安装包 + 运行环境」，把本项目的 Node.js、依赖、ffmpeg 等都打好包。
- **容器（Container）**：镜像跑起来后的进程，隔离、可重启。
- **卷（Volume）**：把 **数据库** 和 **用户上传的文件** 存在容器外面，升级或重建容器时数据不会丢。

本仓库用 **Docker Compose** 一条命令：构建镜像、启动容器、挂卷、配环境变量。

---

## 2. 安装 Docker

### 2.1 Linux（以 Ubuntu / Debian 为例）

官方文档：<https://docs.docker.com/engine/install/ubuntu/>

常用步骤概要：

```bash
# 安装 Docker Engine（按官网选择你的发行版）
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

安装完成后验证：

```bash
sudo docker run --rm hello-world
docker compose version
```

若提示 `docker compose` 找不到，说明未安装 **compose 插件**；可再执行：

```bash
sudo apt-get install -y docker-compose-plugin
```

**把当前用户加入 docker 组**（可选，避免每次 `sudo`）：

```bash
sudo usermod -aG docker $USER
# 重新登录终端后生效
```

### 2.2 仅测试：Windows / macOS

安装 **Docker Desktop**，自带 `docker` 与 `docker compose`。本手册后续命令在「Docker 已能运行」的前提下通用。

---

## 3. 部署前你要准备什么

| 项目 | 说明 |
|------|------|
| 本仓库代码 | `git clone` 到服务器，或上传解压到某目录 |
| `SESSION_SECRET` | 一长串随机字符，用于加密登录会话。**不要泄露、不要提交到 Git** |
| 端口 | 默认对外 **3000**，可被占用时需改 `PUBLISH_PORT` |

生成 `SESSION_SECRET` 示例（在服务器上执行一次，复制输出填进 `.env`）：

```bash
openssl rand -base64 48
```

---

## 4. 第一次部署（逐步操作）

以下命令中的 **项目根目录** 指含有 `docker-compose.yml`、`Dockerfile` 的目录（即本仓库根目录）。

### 步骤 1：进入项目目录

```bash
cd /path/to/faq_system
```

### 步骤 2：创建环境变量文件

```bash
cp .env.example .env
nano .env
# 或用 vim / 其它编辑器
```

至少填写一行（把下面换成你 `openssl rand -base64 48` 的结果）：

```env
SESSION_SECRET=这里粘贴你的随机字符串
PUBLISH_PORT=3000
```

保存退出。

> **注意**：`SESSION_SECRET` 不能为空，否则 `docker compose up` 会报错。

### 步骤 3：拉取基础镜像并构建（首次较慢）

需要服务器能访问 Docker Hub（下载 `node` 等基础镜像）。

```bash
docker compose build
```

### 步骤 4：后台启动

```bash
docker compose up -d
```

`-d` 表示在后台运行。

### 步骤 5：检查是否起来

```bash
docker compose ps
curl -s http://127.0.0.1:3000/health
```

若 `PUBLISH_PORT` 改成了别的端口，把 `3000` 换成该端口。

浏览器访问：`http://服务器IP:3000`（或你的端口）。

默认账号见项目根目录 `README.md` 中的「默认账号」表；**上线后请尽快修改密码**。

---

## 5. 常用运维命令

在项目根目录执行：

| 目的 | 命令 |
|------|------|
| 看日志（最近） | `docker compose logs -f --tail=200 app` |
| 重启应用 | `docker compose restart app` |
| 停止 | `docker compose stop` |
| 停止并删除容器（**不删卷，数据仍在**） | `docker compose down` |
| 查看容器状态 | `docker compose ps` |

---

## 6. 数据存在哪里？如何备份？

Compose 里定义了命名卷 **`faq_data`**，挂载到容器内的 **`/data`**：

- SQLite 数据库文件：`/data/faq.db`（容器内路径）
- 上传附件：`/data/uploads/`

**备份思路**：把卷里的文件拷出来，或整卷备份。

查看卷名并备份示例（卷名可能带项目名前缀）：

```bash
docker volume ls | grep faq
# 假设卷名为 faq_system_faq_data，用临时容器打包
docker run --rm -v faq_system_faq_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/faq_data_backup_$(date +%Y%m%d).tar.gz -C /data .
```

恢复时把压缩包解压回卷或新卷（需自行规划停机时间，避免数据库损坏）。

---

## 7. 更新到新版本代码

```bash
cd /path/to/faq_system
git pull   # 或替换为新代码
docker compose build --no-cache
docker compose up -d
```

数据在卷里，一般不会因为重建镜像而丢失。

---

## 8. 放在 Nginx 反向代理后面（可选）

当你用 **HTTPS** 对外提供服务时，建议在 `.env` 里增加：

```env
TRUST_PROXY=1
SESSION_COOKIE_SECURE=true
```

然后 `docker compose up -d` 使配置生效。

Nginx 中把请求反代到本机 `127.0.0.1:3000`（或你设的 `PUBLISH_PORT`）即可；具体 `server` 块需按你的域名和证书配置，可参考 Nginx 官方文档。

---

## 9. 常见问题

**Q：`docker compose up` 报错「请在 .env 中设置 SESSION_SECRET」**  
A：编辑 `.env`，给 `SESSION_SECRET` 赋一个非空的长随机字符串。

**Q：浏览器能打开页面但无法登录**  
A：若前面有 HTTPS 代理，检查是否设置了 `TRUST_PROXY=1` 和 `SESSION_COOKIE_SECURE=true`；纯 HTTP 访问时不要设 `SESSION_COOKIE_SECURE=true`。

**Q：构建很慢或失败，提示拉不下镜像**  
A：多为网络无法访问 Docker Hub。可配置镜像加速、HTTP 代理，或在能联网的机器上构建后 `docker save` / `docker load` 到服务器。

**Q：端口被占用**  
A：在 `.env` 里改 `PUBLISH_PORT=8080`（示例），再 `docker compose up -d`。

**Q：不想用 Docker**  
A：可看项目根目录 `README.md` 的本地运行说明，以及 `deploy.sh`；生产环境同样需要设置 `NODE_ENV=production` 与 `SESSION_SECRET`。

---

## 10. 健康检查与监控

应用提供 **`GET /health`**，返回 JSON（含 `status`、`uptime`）。负载均衡或监控系统可定期请求该地址判断服务是否正常。

---

## 11. 从镜像仓库拉取运行（进阶）

若团队已通过 CI 将镜像推送到 `ghcr.io`，可在服务器上只准备 `docker-compose.yml` 与 `.env`，把 `build: .` 换成 `image: ghcr.io/你的组织/faq_system:标签`，不再在服务器上 `build`。具体标签以你们发布流程为准。

---

如有环境与本文不一致（例如 Kubernetes、云厂商托管容器），可把本手册中的「卷、环境变量、端口、健康检查」对应到平台配置即可。
