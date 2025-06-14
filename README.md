# Proba

파일(`.csv`, `xlsx`, `xls`)을 업로드하고 AI를 통해 데이터를 분석할 수 있는 웹 애플리케이션입니다.

## Run

### 1. Envrionment Variables

`.env` 파일을 생성하고 다음 환경 변수를 설정하세요:

```bash
GEMINI_API_KEY=key
GEMINI_MODEL=gemini-2.0-flash
CHAT_CONTEXT_LIMIT=3
```

### 2. Commands

```bash
# 실행
docker-compose up -d

# 중지
docker-compose down
```

### 3. Access

`http://localhost:3000`
