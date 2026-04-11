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

  const { name, email, password, phone } = req.body;

  // Validação básica
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  // Mock: Simular sucesso
  res.status(201).json({
    success: true,
    message: 'Conta criada com sucesso!',
    user: {
      id: Math.random().toString(36).substr(2, 9),
      name,
      email,
      phone: phone || null,
      createdAt: new Date().toISOString()
    },
    token: 'mock-jwt-token-' + Math.random().toString(36).substr(2, 9)
  });
}
