const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config();
const stripe = require('stripe')(process.env.STRPIE_secret_key)


const app = express()

app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "https://react-learnify-web.netlify.app",
        ]
    })
);
app.use(express.json())
const port = process.env.PORT || 5000;



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oeipnk8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection

        const userCollection = client.db('Learnify').collection('users')
        const teacherRequestCollection = client.db('Learnify').collection('teacherRequest')
        const classCollection = client.db('Learnify').collection('classes')
        const paymentCollection = client.db('Learnify').collection('payment')
        const assignmentCollection = client.db('Learnify').collection('assignment')
        const submissionsCollection = client.db('Learnify').collection('submission')
        const feedbackCollection = client.db('Learnify').collection('feedback')
        const quizCollection = client.db('Learnify').collection("quiz")


        //middleWires
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "forbidden access" })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "forbidden access" })
                }
                req.decoded = decoded
                next()
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send('forbidden access');
            }
            next()
        }

        //jwt api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })


        //web related api
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        app.post('/feedback', async (req, res) => {
            const feedback = req.body;

            const result = await feedbackCollection.insertOne(feedback)
            res.send(result)
        })

        app.get('/feedback', async (req, res) => {
            let query = {};
            if (req.query.id) {
                query = { classId: req.query.id }
            }
            const result = await feedbackCollection.find(query).toArray();
            res.send(result)
        })




        app.get('/learnify-stat', async (req, res) => {
            const acceptedClassCount = await classCollection.countDocuments({ status: "accepted" });
            const userCount = await userCollection.estimatedDocumentCount()
            const allClassCount = await classCollection.estimatedDocumentCount()
            const requestCount = await teacherRequestCollection.estimatedDocumentCount()

            const result = await classCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalEnrollment: { $sum: "$total_enrollment" }
                    }
                }
            ]).toArray();


            const totalEnrollment = result.length > 0 ? result[0].totalEnrollment : 0;

            res.send({ acceptedClassCount, allClassCount, requestCount, userCount, totalEnrollment })
        })



        app.get('/users/teacher/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let teacher = false;
            if (user) {
                teacher = user?.role === 'teacher';
            }
            res.send({ teacher });
        })




        app.get('/users', verifyToken, async (req, res) => {
            let query = {}
            if (req.query.email) {
                query = { email: req.query.email }
            }
            if (req.query.page && req.query.size) {
                const currentPage = parseInt(req.query.page);
                const size = parseInt(req.query.size);
                if (req.query.search) {
                    query.name = { $regex: req.query.search, $options: 'i' }; // case-insensitive search
                    const result = await userCollection.find(query).toArray()
                    res.send(result)
                    return
                }
                const result = await userCollection.find(query).skip((currentPage - 1) * size).limit(size).toArray()
                res.send(result)
                return
            }
            const result = await userCollection.find(query).toArray();
            res.send(result)
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const isExist = await userCollection.findOne(query);
            if (isExist) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        app.patch('/user/:email', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updatedDoc = {
                $set: {
                    role: req.body.role
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.post('/teacherRequest', verifyToken, async (req, res) => {
            const request = req.body;
            const result = await teacherRequestCollection.insertOne(request)
            res.send(result)
        })

        app.put('/teacherRequest/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const request = req.body;
            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    userName: request.userName,
                    email: request.email,
                    experience: request.experience,
                    title: request.title,
                    category: request.category,
                    status: request.status,
                    photoURL: request.photoURL
                }
            }

            const result = await teacherRequestCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })

        app.patch('/teacherRequest/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: req.body.status
                }
            }
            const result = await teacherRequestCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.get('/teacherRequest', async (req, res) => {
            let query = {};
            if (req.query.email) {
                query = { email: req.query.email };
            }
        
            // Extract page and size from query parameters
            const page = parseInt(req.query.page) || 1;  
            const size = parseInt(req.query.size) || 10; 
        
            try {
                const skip = (page - 1) * size;
        
                const result = await teacherRequestCollection.find(query)
                    .skip(skip)
                    .limit(size)
                    .toArray();
        
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Error fetching teacher requests', error });
            }
        });

        app.post('/classes', verifyToken, async (req, res) => {
            const aClass = req.body;
            const result = await classCollection.insertOne(aClass)
            res.send(result)
        })

        app.post('/classes/:id/assignments', verifyToken, async (req, res) => {
            const { id } = req.params;
            const { title, deadline, description } = req.body;

            const newAssignment = {
                title,
                deadline,
                description,
                classId: new ObjectId(id)
            };

            const result = await assignmentCollection.insertOne(newAssignment);
            res.send(result)
        });

        //quiz post api
        app.post('/classes/:id/quizes', verifyToken, async(req, res)=>{
            const {id} = req.params;
            const {quizTitle, quizTime, questionJson} = req.body;

            const newQuiz ={
                quizTitle,
                quizTime,
                questionJson,
                classId: new ObjectId(id)
            };

            const result = await quizCollection.insertOne(newQuiz);
            res.send(result);
        })

        //quiz get api
        app.get('/quizes/:id', verifyToken, async(req, res)=>{
            const {id} = req.params;
            const query = {classId: new ObjectId(id)}
            const result = await quizCollection.find(query).toArray()
            res.send(result);
        })

        app.get('/quiz/:id',verifyToken,  async(req, res)=>{
            const {id}= req.params;
            const query = {_id: new ObjectId(id)};
            const result = await quizCollection.findOne(query);
            res.send(result);
        })

        app.get('/assignment/:id', async (req, res) => {
            const id = req.params.id
            const query = { classId: new ObjectId(id) }
            const result = await assignmentCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/assignment', verifyToken, async (req, res) => {
            const result = await assignmentCollection.find().toArray()
            res.send(result)
        })

        app.post('/submit/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const submission = {
                classId: new ObjectId(id),
                submissionDate: new Date(),
            }
            const result = await submissionsCollection.insertOne(submission)
            res.send(result)
        })

        // Route to retrieve submission data for a specific class
        app.get('/submission-data/:classId', verifyToken, async (req, res) => {
            try {
                const { classId } = req.params;

                const aggregationPipeline = [
                    {
                        $match: { classId: new ObjectId(classId) }
                    },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$submissionDate" } },
                            totalSubmissions: { $sum: 1 }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalSubmissions: { $sum: "$totalSubmissions" },
                            uniqueSubmissionDates: { $sum: 1 }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            totalSubmissions: 1,
                            uniqueSubmissionDates: 1,
                            submissionsPerDate: { $divide: ["$totalSubmissions", "$uniqueSubmissionDates"] }
                        }
                    }
                ];

                const result = await submissionsCollection.aggregate(aggregationPipeline).toArray();

                if (result.length > 0) {
                    res.send(result[0]);
                } else {
                    res.send({ totalSubmissions: 0, uniqueSubmissionDates: 0, submissionsPerDate: 0 });
                }
            } catch (error) {
                console.error('Error fetching submission data:', error);
                res.status(500).send('Internal server error');
            }
        });

        // Route to get the number of assignments for a specific class
        app.get('/assignments-count/:classId', verifyToken, async (req, res) => {
            try {
                const { classId } = req.params;

                const aggregationPipeline = [
                    {
                        $match: { classId: new ObjectId(classId) }
                    },
                    {
                        $group: {
                            _id: "$classId",
                            totalAssignments: { $sum: 1 }
                        }
                    },
                    {
                        $project: {
                            classId: "$_id",
                            totalAssignments: 1,
                            _id: 0
                        }
                    }
                ];

                const assignmentCounts = await assignmentCollection.aggregate(aggregationPipeline).toArray();

                if (assignmentCounts.length > 0) {
                    res.send(assignmentCounts[0]);
                } else {
                    res.send({ classId: classId, totalAssignments: 0 });
                }
            } catch (error) {
                console.error('Error fetching assignment counts:', error);
                res.status(500).send('Internal server error');
            }
        });




        app.delete('/class/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await classCollection.deleteOne(query)
            res.send(result)
        })


        app.get('/user-classes/:email', verifyToken, async (req, res) => {
            const userEmail = req.params.email;

            // Find all payments made by the user
            const payments = await paymentCollection.find({ email: userEmail }).toArray();

            if (payments.length === 0) {
                return res.status(404).send('No classes found for this user');
            }

            // Extract classIds from the payments
            const classIds = payments.map(payment => new ObjectId(payment.classId));

            // Find classes corresponding to the classIds
            const classes = await classCollection.find({ _id: { $in: classIds } }).toArray();

            res.send(classes);
        });



        app.get('/classes', async (req, res) => {
            try {
                let query = {};

                // Handle filtering by email
                if (req.query.email) {
                    query = { email: req.query.email };
                }

                // Handle filtering by id
                if (req.query.id) {
                    query = { _id: new ObjectId(req.query.id) };
                }

                // Pagination
                const page = parseInt(req.query.page) || 1;
                const pageSize = parseInt(req.query.size) || 6;
                const skip = (page - 1) * pageSize;

                if (req.query.status === 'accepted') {
                    query.status = 'accepted'
                }

                // Search by class name
                if (req.query.search) {
                    query.title = { $regex: req.query.search, $options: 'i' };
                }

                // Perform the query
                const classes = await classCollection.find(query)
                    .skip(skip)
                    .limit(pageSize)
                    .toArray();

                res.send(classes);
            } catch (error) {
                console.error('Error fetching classes:', error);
                res.status(500).send({ error: 'An error occurred while fetching classes.' });
            }
        });

        app.put('/class/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const bodyClass = req.body;
            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    title: bodyClass.title,
                    price: bodyClass.price,
                    description: bodyClass.description,
                    image: bodyClass.image
                }
            }

            const result = await classCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })

        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })



        app.post('/payment', async (req, res) => {
            const payment = req.body;

            const paymentResult = await paymentCollection.insertOne(payment);

            // Find the class and increment its total enrollment
            const filter = { _id: new ObjectId(payment.classId) };
            const classDoc = await classCollection.findOne(filter);

            if (classDoc) {
                const updatedDoc = {
                    $set: {
                        total_enrollment: (classDoc.total_enrollment || 0) + 1 // Ensure total_enrollment is a number
                    },
                    $push: {
                        total_students: {
                            userName: payment.userName,
                            imageUrl: payment.imageUrl,
                            email: payment.email
                        }
                    }
                };
                const updateResult = await classCollection.updateOne(filter, updatedDoc);
                res.send({ paymentResult, updateResult });
            }

        })

        app.patch('/class/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: req.body.status
                }
            }

            const result = await classCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })



        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('server is running....');
})

app.listen(port, () => {
    console.log(`server is running on port: ${port}`)
})

//deploy vercel