require("./flows/CSBmanager");
require("./flows/remoteSwarming");
const path = require("path");
const Server = require('./libs/http-wrapper/src/index').Server;

function VirtualMQ(listeningPort, rootFolder, callback) {
	const port = listeningPort || 8080;
	const server = new Server().listen(port);
	const CSB_storage_folder = "uploads";
	const SWARM_storage_folder = "swarms";
	console.log("Listening on port:", port);

	this.close = server.close;

	$$.flow.create("CSBmanager").init(path.join(rootFolder, CSB_storage_folder), function (err, result) {
		if (err) {
			throw err;
		} else {
			console.log("CSBmanager is using folder", result);
			$$.flow.create("RemoteSwarming").init(path.join(rootFolder, SWARM_storage_folder), function(err, result){
				registerEndpoints();
				if (callback) {
					callback();
				}
			});
		}
	});



	function registerEndpoints() {

		server.post('/:channelId', function (req, res) {

			$$.flow.create("RemoteSwarming").startSwarm(req.params.channelId, req, function (err, result) {
				res.statusCode = 201;
				if (err) {
					console.log(err);
					res.statusCode = 500;
				}
				res.end();
			});
		});

		server.get('/:channelId', function (req, res) {

			$$.flow.create("RemoteSwarming").waitForSwarm(req.params.channelId, res, function (err, result) {
				if (err) {
					console.log(err);
					res.statusCode = 500;
				}
				res.end();
			});
		});

		server.post('/CSB/:fileId', function (req, res) {
			if (req.headers['content-type'] !== 'application/octet-stream') {

				$$.flow.create("CSBmanager").write(req.params.fileId, req, function (err, result) {
					res.statusCode = 201;
					if (err) {
						console.log(err);
						res.statusCode = 500;
					}
					res.end();
				});
			}
		});

		server.get('/CSB/:fileId', function (req, res) {
			$$.flow.create("CSBmanager").read(req.params.fileId, res, function (err, result) {
				res.statusCode = 200;
				if (err) {
					console.log(err);
					res.statusCode = 404;
				}
				res.end();
			});
		});

		server.use(function (req, res) {
			res.statusCode = 404;
			res.end();
		});
	}
}

module.exports.createVirtualMQ = function(port, folder, callback){
	return new VirtualMQ(port, folder, callback);
}