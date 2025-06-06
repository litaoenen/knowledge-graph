# 知识图谱应用部署文档

## 目录结构

- `source/`: 源代码目录
- `dist/`: 编译后的生产环境代码

## 源码说明

源码目录包含项目的完整源代码：

- `src/`: 主要源代码
- `public/`: 静态资源文件
- `package.json` 和 `package-lock.json`: 依赖管理
- `tsconfig.json`: TypeScript配置
- `README.md`: 项目说明

## 编译步骤

1. 安装依赖：
```bash
cd source
npm install
```

2. 编译项目：
```bash
npm run build
```

编译后的文件将生成在 `build` 目录中。

## 部署方法

1. 将编译后的文件复制到服务器：
```bash
cp -r build/* /path/to/server/public
```

2. 配置Web服务器（Nginx示例）：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/server/public;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

3. 本地测试（使用serve工具）：
```bash
npx serve -s dist
```

## 常见问题

- 如果遇到API连接问题，请检查后端API地址配置
- 浏览器兼容性：本应用最佳支持Chrome、Firefox、Edge最新版本
