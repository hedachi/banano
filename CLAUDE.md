# Banano

## デプロイ

- デプロイ先: Mac mini (`hedachi@hedachimacmini`) Tailscale経由
- コード配置先: `/Users/hedachi/banano-web/`
- プロセス管理: pm2 (プロセス名: `banano`)
- URL: `http://hedachimacmini:3000/`

### 手順

1. GitHubにpush
2. `./deploy.sh` 実行（git pull → npm install → pm2 restart）

### Mac miniで直接操作

```bash
# ログ確認
ssh hedachi@hedachimacmini "bash -l -c 'pm2 logs banano --lines 30'"

# 状態確認
ssh hedachi@hedachimacmini "bash -l -c 'pm2 status'"

# 再起動
ssh hedachi@hedachimacmini "bash -l -c 'pm2 restart banano'"
```

### 注意

- SSHの非ログインシェルではHomebrewのPATHが通らないので `bash -l -c '...'` で実行する
- `.env`（GOOGLE_API_KEY）はgit管理外。Mac mini側に直接配置済み
- `uploads/` と `banano.db` はMac mini側のローカルデータ。gitに含まれない
