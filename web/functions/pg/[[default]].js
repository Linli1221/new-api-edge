/**
 * EdgeOne Pages 反向代理 - 增强版
 * 修复白屏和资源加载问题
 */

export async function onRequest(context) {
    // 源站地址
    const ORIGIN = "http://166.108.203.60:3000";
    
    // 获取请求信息
    const request = context.request;
    const url = new URL(request.url);
    const path = url.pathname + url.search;
    
    // 特殊处理根路径"/"请求
    const targetUrl = path === "/" ? 
      `${ORIGIN}/` : 
      `${ORIGIN}${path}`;
    
    try {
      // 开始处理请求
      console.log(`代理请求 ${request.method} ${path}`);
  
      // 创建发往源站的请求头
      const headers = new Headers();
      
      // 转发原始请求头
      for (const [key, value] of request.headers.entries()) {
        // 排除一些特定的头
        if (!['host', 'cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'connection'].includes(key.toLowerCase())) {
          try {
            headers.set(key, value);
          } catch (e) {
            console.error(`无法设置请求头 ${key}: ${e.message}`);
          }
        }
      }
      
      // 设置必要的请求头
      headers.set('Host', new URL(ORIGIN).host);
      headers.set('Origin', ORIGIN);
      headers.set('Referer', `${ORIGIN}${path}`);
      
      // 判断是否有Cookie，并打印日志
      const cookies = request.headers.get('cookie');
      if (cookies) {
        console.log(`转发Cookie: ${cookies.substring(0, 100)}...`);
      }
      
      // 创建请求选项
      const requestInit = {
        method: request.method,
        headers: headers,
        redirect: 'follow',
      };
      
      // 处理POST/PUT请求体
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try {
          const contentType = request.headers.get('content-type');
          const bodyText = await request.clone().text();
          requestInit.body = bodyText;
          console.log(`请求体类型: ${contentType}, 长度: ${bodyText.length}`);
        } catch (e) {
          console.error(`无法读取请求体: ${e.message}`);
        }
      }
      
      // 发送请求
      console.log(`请求源站: ${targetUrl}`);
      const response = await fetch(targetUrl, requestInit);
      console.log(`源站响应状态: ${response.status} ${response.statusText}`);
      
      // 处理404错误，可能是因为路径问题，尝试重定向到主页
      if (response.status === 404 && path === "/") {
        console.log("检测到主页404错误，尝试访问源站根目录");
        return await fetch(`${ORIGIN}/`, requestInit)
          .then(async indexResponse => {
            if (indexResponse.ok) {
              console.log("成功获取主页内容");
              // 处理响应...
              return createProxyResponse(indexResponse, url);
            } else {
              throw new Error("无法获取主页内容");
            }
          });
      }
      
      // 创建响应头
      const responseHeaders = new Headers();
      
      // 收集Set-Cookie头部
      const setCookieHeaders = [];
      
      // 处理响应头
      for (const [key, value] of response.headers.entries()) {
        // 特殊处理set-cookie头部
        if (key.toLowerCase() === 'set-cookie') {
          setCookieHeaders.push(value);
        } else if (key.toLowerCase() === 'content-encoding') {
          // 跳过content-encoding，让响应以解压缩状态传输
          console.log(`跳过压缩头 ${key}=${value}`);
          continue;
        } else {
          try {
            responseHeaders.set(key, value);
          } catch (e) {
            console.log(`跳过响应头 ${key}: ${e.message}`);
          }
        }
      }
      
      // 重新添加所有Cookie
      if (setCookieHeaders.length > 0) {
        console.log(`返回${setCookieHeaders.length}个Cookie`);
        setCookieHeaders.forEach(cookie => {
          responseHeaders.append('Set-Cookie', cookie);
        });
      }
      
      // 处理CORS头
      responseHeaders.set('Access-Control-Allow-Origin', url.origin);
      responseHeaders.set('Access-Control-Allow-Credentials', 'true');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, New-API-User');
      
      // OPTIONS请求特殊处理
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: responseHeaders
        });
      }
      
      // 获取响应内容类型
      const contentType = response.headers.get('content-type') || '';
      console.log(`响应内容类型: ${contentType}`);
      
      // 根据请求的资源类型处理响应
      
      // 1. HTML响应
      if (contentType.includes('text/html')) {
        let htmlContent = await response.text();
        console.log(`HTML响应大小: ${htmlContent.length} 字符`);
        console.log(`HTML内容开头: ${htmlContent.substring(0, 100).replace(/\n/g, '↵')}...`);
        
        // 确保内容类型正确
        if (!responseHeaders.has('content-type')) {
          responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
        }
        
        // 修复HTML中的绝对路径链接
        htmlContent = htmlContent.replace(/href=["']http:\/\/166\.108\.203\.60:3000\//g, 'href="/');
        htmlContent = htmlContent.replace(/src=["']http:\/\/166\.108\.203\.60:3000\//g, 'src="/');
        
        return new Response(htmlContent, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
      // 2. JavaScript响应
      else if (contentType.includes('javascript') || path.endsWith('.js')) {
        const jsContent = await response.text();
        console.log(`JS响应大小: ${jsContent.length} 字符`);
        
        // 设置正确的内容类型
        responseHeaders.set('Content-Type', 'application/javascript; charset=utf-8');
        
        return new Response(jsContent, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
      // 3. CSS响应
      else if (contentType.includes('text/css') || path.endsWith('.css')) {
        const cssContent = await response.text();
        console.log(`CSS响应大小: ${cssContent.length} 字符`);
        
        // 设置正确的内容类型
        responseHeaders.set('Content-Type', 'text/css; charset=utf-8');
        
        return new Response(cssContent, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
      // 4. JSON响应
      else if (contentType.includes('application/json') || path.includes('/api/') || path.endsWith('.json')) {
        const jsonText = await response.text();
        console.log(`JSON响应大小: ${jsonText.length} 字符`);
        
        // 确保是有效的JSON
        try {
          JSON.parse(jsonText);
        } catch (e) {
          console.log(`警告: 响应声称是JSON，但格式不正确: ${e.message}`);
        }
        
        // 设置正确的内容类型
        responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
        
        return new Response(jsonText, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
      // 5. 字体文件
      else if (['.woff', '.woff2', '.ttf', '.eot', '.otf'].some(ext => path.toLowerCase().endsWith(ext))) {
        const fontData = await response.arrayBuffer();
        console.log(`字体文件响应大小: ${fontData.byteLength} 字节`);
        
        // 确保MIME类型正确
        if (path.endsWith('.woff')) responseHeaders.set('Content-Type', 'font/woff');
        else if (path.endsWith('.woff2')) responseHeaders.set('Content-Type', 'font/woff2');
        else if (path.endsWith('.ttf')) responseHeaders.set('Content-Type', 'font/ttf');
        else if (path.endsWith('.eot')) responseHeaders.set('Content-Type', 'application/vnd.ms-fontobject');
        else if (path.endsWith('.otf')) responseHeaders.set('Content-Type', 'font/otf');
        
        return new Response(fontData, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
      // 6. 图片文件
      else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].some(ext => path.toLowerCase().endsWith(ext))) {
        const imageData = await response.arrayBuffer();
        console.log(`图片响应大小: ${imageData.byteLength} 字节`);
        
        // 确保MIME类型正确
        if (path.endsWith('.png')) responseHeaders.set('Content-Type', 'image/png');
        else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) responseHeaders.set('Content-Type', 'image/jpeg');
        else if (path.endsWith('.gif')) responseHeaders.set('Content-Type', 'image/gif');
        else if (path.endsWith('.webp')) responseHeaders.set('Content-Type', 'image/webp');
        else if (path.endsWith('.svg')) responseHeaders.set('Content-Type', 'image/svg+xml');
        else if (path.endsWith('.ico')) responseHeaders.set('Content-Type', 'image/x-icon');
        
        return new Response(imageData, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
      // 7. 其他所有类型的响应
      else {
        const data = await response.arrayBuffer();
        console.log(`其他类型响应大小: ${data.byteLength} 字节`);
        
        return new Response(data, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
    } catch (err) {
      console.error(`代理请求失败: ${err.message}`);
      console.error(err.stack);
      
      // 返回错误信息
      return new Response(
        `<!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <title>代理请求失败</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
            .error { background: #fff0f0; border: 1px solid #ffccc7; padding: 1rem; border-radius: 4px; }
            .details { margin-top: 1rem; background: #f5f5f5; padding: 1rem; border-radius: 4px; }
            code { font-family: monospace; background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>代理请求失败</h1>
          <div class="error">
            <p><strong>错误信息:</strong> ${err.message}</p>
          </div>
          <div class="details">
            <p><strong>请求路径:</strong> <code>${path}</code></p>
            <p><strong>目标URL:</strong> <code>${targetUrl}</code></p>
            <p><strong>请求方法:</strong> ${request.method}</p>
            <p><strong>时间:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p>请刷新页面重试，或联系管理员。</p>
        </body>
        </html>`, 
        { 
          status: 500, 
          headers: { 
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store" 
          } 
        }
      );
    }
  }
  
  // 帮助函数：创建代理响应
  function createProxyResponse(response, originalUrl) {
    // 创建响应头
    const responseHeaders = new Headers();
    
    // 收集Set-Cookie头部
    const setCookieHeaders = [];
    
    // 处理响应头
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        setCookieHeaders.push(value);
      } else if (key.toLowerCase() === 'content-encoding') {
        continue;
      } else {
        try {
          responseHeaders.set(key, value);
        } catch (e) {
          console.log(`跳过响应头 ${key}: ${e.message}`);
        }
      }
    }
    
    // 重新添加所有Cookie
    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach(cookie => {
        responseHeaders.append('Set-Cookie', cookie);
      });
    }
    
    // 处理CORS头
    responseHeaders.set('Access-Control-Allow-Origin', originalUrl.origin);
    responseHeaders.set('Access-Control-Allow-Credentials', 'true');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, New-API-User');
    
    // 获取HTML内容并替换链接
    return response.text().then(htmlContent => {
      // 修复HTML中的绝对路径链接
      htmlContent = htmlContent.replace(/href=["']http:\/\/166\.108\.203\.60:3000\//g, 'href="/');
      htmlContent = htmlContent.replace(/src=["']http:\/\/166\.108\.203\.60:3000\//g, 'src="/');
      
      responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
      
      return new Response(htmlContent, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    });
  }