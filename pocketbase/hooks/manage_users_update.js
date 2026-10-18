routerAdd(
  'POST',
  '/backend/v1/users/update',
  (e) => {
    const body = e.requestInfo().body || {}
    const profileId = String(body.profileId || '').trim()
    const name = String(body.name || '').trim()
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    const active = body.active !== undefined ? Boolean(body.active) : undefined
    const password = body.password ? String(body.password) : ''

    if (!profileId) {
      return e.badRequestError('ID do perfil é obrigatório.')
    }
    if (!name) {
      return e.badRequestError('O nome não pode ficar em branco.')
    }
    if (!email || !email.includes('@')) {
      return e.badRequestError('E-mail válido é obrigatório.')
    }
    if (password && password.length < 8) {
      return e.badRequestError('A nova senha deve ter pelo menos 8 caracteres.')
    }

    let profile
    try {
      profile = $app.findFirstRecordByData('profiles', 'id', profileId)
    } catch (_) {
      return e.notFoundError('Perfil não encontrado.')
    }

    const userId = profile.getString('user')
    let userRecord
    try {
      userRecord = $app.findFirstRecordByData('_pb_users_auth_', 'id', userId)
    } catch (_) {
      return e.notFoundError('Usuário associado não encontrado.')
    }

    // Se mudou o e-mail, verificar se outro usuário já possui
    const currentEmail = userRecord.getString('email')
    if (email !== currentEmail) {
      try {
        const checkUser = $app.findAuthRecordByEmail('_pb_users_auth_', email)
        if (checkUser && checkUser.id !== userId) {
          return e.badRequestError('Já existe outro usuário com este e-mail.')
        }
      } catch (_) {}
    }

    try {
      $app.runInTransaction((txApp) => {
        // Atualizar user auth record
        userRecord.set('name', name)
        if (email !== currentEmail) {
          userRecord.setEmail(email)
        }
        if (password) {
          userRecord.setPassword(password)
        }
        txApp.save(userRecord)

        // Atualizar perfil
        profile.set('name', name)
        profile.set('email', email)
        if (active !== undefined) {
          profile.set('active', active)
        }
        txApp.save(profile)
      })
    } catch (err) {
      return e.badRequestError('Não foi possível atualizar o usuário: ' + err.message)
    }

    const updatedProfile = $app.findFirstRecordByData('profiles', 'id', profileId)

    return e.json(200, {
      id: updatedProfile.id,
      user: userId,
      name: updatedProfile.getString('name'),
      email: updatedProfile.getString('email'),
      active: updatedProfile.getBool('active'),
      created: updatedProfile.getString('created'),
      updated: updatedProfile.getString('updated'),
    })
  },
  $apis.requireAuth(),
)
