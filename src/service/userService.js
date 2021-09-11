const { userRepository } = require('../repository/repository.index');
const { cryptUtil } = require('../utils/utils.index');
const { stateEnums } = require('../model/enums/enums.index');
const emailService = require('./emailService');

/**
 * @description Gets the all users
 *
 * @returns {Promise<{success: boolean, error: *} | {success: boolean, data: [*]}>}
 * {success: false, error: any} or {success: true, data: [users]}
 */
exports.getAllUsers = async () => {
	try {
		const users = await userRepository.getAllUsers();

		return { success: true, data: users };
	} catch (error) {
		throw { success: false, error: any };
	}
};

/**
 * @description Gets user by id
 * @param id {property} User Id
 * @returns {Promise<{success: boolean, error: *} | {success: boolean, data: user}>}
 * {success: false, error: any} or {success: true, data: {user}}
 */
exports.getUser = async id => {
	try {
		const user = await userRepository.getUser(id);

		return { success: true, data: user };
	} catch (error) {
		throw { success: false, error: any };
	}
};

/**
 * @description Create User
 * @param user {object} Object containing all required fields to
 * create user
 *
 * @returns {Promise<{success: boolean, error: *} | {success: boolean}>}
 * {success: false, error: any} or {success: true}
 */
exports.createUser = async user => {
	try {
		const existUser = await userRepository.getUserByEmail(user.email);

		if (existUser) return { success: false, error: 'This email is in use' };

		await userRepository.createUser(user);

		return { success: true };
	} catch (error) {
		throw { success: false, error: any };
	}
};

/**
 * @description UpdateUser User
 * @param user {object} Object containing all required fields to
 * update user
 *
 * @returns {Promise<{success: boolean, error: *} | {success: boolean}>}
 * {success: false, error: any} or {success: true}
 */
exports.updateUser = async user => {
	try {
		await userRepository.updateUser(user);

		return { success: true };
	} catch (error) {
		throw { success: false, error: any };
	}
};

/**
 * @description Authenticate user by email and password
 * @param email {property} Email
 * @param password {property} Password
 * @returns {Promise<{success: boolean, error: *} | {success: boolean, data: user}>}
 * {success: false, error: any} or {success: true, data: {user}}
 */
exports.authenticateUser = async (email, password) => {
	try {
		const user = await userRepository.getUserByEmail(email);

		if (!user || user.state !== stateEnums.UserState.Active) return { success: false };

		const pswDto = {
			hashPassword: user.password,
			salt: user.salt,
			password
		};

		const isMatch = cryptUtil.verifyHash(pswDto);

		if (!isMatch) return { success: false };

		const token = cryptUtil.createToken({
			userId: user.id,
			name: user.name,
			email: user.email,
			isLoggedIn: true
		});
		user.lastLoginDateTime = new Date();

		await userRepository.updateUser(user);

		return {
			success: true,
			data: {
				name: user.name,
				email: user.email,
				token
			}
		};
	} catch (error) {
		throw { success: false, error };
	}
};

/**
 * @description Gets user by email and sends an email with code to renew password
 * @param email {property} Email
 * @returns {Promise<{success: boolean, error: *} | {success: boolean}>}
 * {success: false, error: any} or {success: true}
 */
exports.forgotPasswordRequest = async email => {
	try {
		const user = await userRepository.getUserByEmail(email);

		if (!user) return { success: false };

		user.verificationCode = cryptUtil.encode(user.email + Date.now());

		userRepository.updateUser(user);

		emailService.sendForgotPasswordMail({
			toAddress: user.email,
			name: user.name,
			code: user.verificationCode
		});

		return { success: true };
	} catch (error) {
		throw { success: false, error: any };
	}
};

/**
 * @description Renew user password
 * @param code {property} Code
 * @param password {property} Password
 * @param token {property} Token
 * @returns {Promise<{success: boolean, error: *} | {success: boolean}>}
 * {success: false, error: any} or {success: true}
 */
exports.renewPassword = async (code, password, token) => {
	try {
		const decodedToken = cryptUtil.decodeToken(token);

		const user = await userRepository.getUser(decodedToken.userId);

		if (!user || !user.verificationCode || user.verificationCode !== code) return { success: false };

		user.password = cryptUtil.hash(password, user.salt);
		user.verificationCode = null;

		userRepository.updateUser(user);

		return { success: true, data: user };
	} catch (error) {
		throw { success: false, error: any };
	}
};

/**
 * @description Register User and send a verification mail
 * @param user {object} Object containing all required fields to create user
 *
 * @returns {Promise<{success: boolean, error: *} | {success: boolean}>}
 * {success: false, error: any} or {success: true}
 */
exports.registerUser = async user => {
	try {
		const existUser = await userRepository.getUserByEmail(user.email);

		if (existUser) return { success: false, error: 'This email is in use' };

		user.verificationCode = cryptUtil.encode(user.email + Date.now());
		const newUser = await userRepository.createUser(user);

		const token = cryptUtil.createToken({
			userId: newUser.id,
			isLoggedIn: false
		});

		emailService.sendAccountVerificationMail({
			toAddress: user.email,
			name: user.name,
			code: user.verificationCode,
			token
		});

		return { success: true };
	} catch (error) {
		throw { success: false, error: any };
	}
};

/**
 * @description Verify user register
 * @param token {property} Token
 * @param code {property} Code
 * @returns {Promise<{success: boolean, error: *} | {success: boolean}>}
 * {success: false, error: any} or {success: true}
 */
exports.verifyRegister = async (token, code) => {
	try {
		const decodedToken = cryptUtil.decodeToken(token);

		const user = await userRepository.getUser(decodedToken.userId);

		if (
			!user ||
			!user.verificationCode ||
			user.verificationCode !== code ||
			user.state !== stateEnums.UserState.NotVerified
		)
			return { success: false };

		user.verificationCode = null;
		user.state = stateEnums.UserState.Active;

		userRepository.updateUser(user);

		return { success: true, data: user };
	} catch (error) {
		throw { success: false, error: any };
	}
};
