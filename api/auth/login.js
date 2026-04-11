export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email, password } = req.body;

  // Validação básica
  if (!email || !password) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  // Mock: Simular sucesso
  res.status(200).json({
    success: true,
    message: 'Bem-vindo de volta!',
    user: {
      id: Math.random().toString(36).substr(2, 9),
      email,
      name: 'Test User',
      createdAt: new Date().toISOString()
    },
    token: 'mock-jwt-token-' + Math.random().toString(36).substr(2, 9)
  });
}
