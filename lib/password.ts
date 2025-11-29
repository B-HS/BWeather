export const hashPassword = async (password: string) => {
    return await Bun.password.hash(password, {
        algorithm: 'argon2id',
        memoryCost: 65536,
        timeCost: 3,
    })
}

export const verifyPassword = async (password: string, hash: string) => {
    return await Bun.password.verify(password, hash)
}
