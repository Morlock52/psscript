FROM mcr.microsoft.com/powershell:7.4-ubuntu-22.04

WORKDIR /app

# Install curl + unzip, then Node.js 20.x (needs modern JS features for the ws/LSP bridge)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates unzip && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install PowerShell modules needed for lint/format
RUN pwsh -NoLogo -NoProfile -Command "Set-PSRepository -Name PSGallery -InstallationPolicy Trusted; Install-Module PSScriptAnalyzer -Scope AllUsers -Force"

# Download PowerShell Editor Services bundle (zip from GitHub releases).
# We keep this in the image so the LSP starts fast and works offline once built.
RUN mkdir -p /opt/powershell-editor-services && \
    curl -fsSL -o /tmp/PowerShellEditorServices.zip https://github.com/PowerShell/PowerShellEditorServices/releases/latest/download/PowerShellEditorServices.zip && \
    unzip -q /tmp/PowerShellEditorServices.zip -d /opt/powershell-editor-services && \
    rm -f /tmp/PowerShellEditorServices.zip

ENV PSES_BUNDLE_PATH=/opt/powershell-editor-services

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src

EXPOSE 7001 7002

CMD ["npm", "run", "start"]
