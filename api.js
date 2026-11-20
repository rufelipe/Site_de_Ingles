var schoolApi = window.schoolApi = async function schoolApi(path, options = {}) {
  const request = { ...options, credentials: 'same-origin', headers: { ...(options.headers || {}) } };
  if (request.body && typeof request.body !== 'string' && !(request.body instanceof Blob) && !(request.body instanceof FormData)) {
    request.headers['Content-Type'] = 'application/json';
    request.body = JSON.stringify(request.body);
  }
  const response = await fetch(path, request);
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : await response.blob();
  if (!response.ok) throw new Error(result?.error || `Erro HTTP ${response.status}`);
  return result;
};
