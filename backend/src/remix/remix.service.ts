import { Injectable } from '@nestjs/common';

@Injectable()
export class RemixService {
  async renderApp(request: any, url: string): Promise<string> {
    // Service Remix temporaire pour éviter les erreurs de compilation
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Application E-commerce</title>
</head>
<body>
    <div id="root">
        <h1>Application E-commerce</h1>
        <p>Frontend en cours de chargement...</p>
        <p>URL demandée: ${url}</p>
    </div>
</body>
</html>`;
  }
}
