const { userRoute, authRoute } = require('./routes.index');
// const { authenticator } = require('../middlewares/middlewares.index');

exports.assignRoutes = app => {
	// app.use(authenticator.checkLang);

	userRoute.assignRoutes(app);
	authRoute.assignRoutes(app);
};
