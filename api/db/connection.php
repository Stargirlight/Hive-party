<?php
// MongoDB Connection Handler for PHP

class Database {
    private static $instance = null;
    private $client = null;
    private $db = null;

    private function __construct() {
        $mongoUri = getenv('MONGODB_URI') ?: 'mongodb://localhost:27017';
        $dbName = 'hive-party';

        // Extract database name from URI if present
        if (preg_match('/\/([^\/\?]+)(\?|$)/', $mongoUri, $matches)) {
            $dbName = $matches[1];
        }

        try {
            // Check if MongoDB extension is available
            if (!class_exists('MongoDB\Driver\Manager')) {
                throw new Exception('MongoDB PHP extension not installed. Please install mongodb extension.');
            }

            $this->client = new MongoDB\Driver\Manager($mongoUri, [
                'serverSelectionTimeoutMS' => 5000,
                'connectTimeoutMS' => 5000,
            ]);

            // Test connection
            $command = new MongoDB\Driver\Command(['ping' => 1]);
            $this->client->executeCommand($dbName, $command);

            $this->db = $dbName;
            error_log('✅ Connected to MongoDB');
        } catch (Exception $e) {
            error_log('❌ MongoDB connection error: ' . $e->getMessage());
            throw $e;
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    public function getClient() {
        return $this->client;
    }

    public function getDbName() {
        return $this->db;
    }

    // Helper method to find documents
    public function find($collection, $filter = [], $options = []) {
        $query = new MongoDB\Driver\Query($filter, $options);
        $namespace = $this->db . '.' . $collection;
        $cursor = $this->client->executeQuery($namespace, $query);
        return $cursor->toArray();
    }

    // Helper method to find one document
    public function findOne($collection, $filter = []) {
        $result = $this->find($collection, $filter, ['limit' => 1]);
        return !empty($result) ? $result[0] : null;
    }

    // Helper method to insert document
    public function insertOne($collection, $document) {
        $bulk = new MongoDB\Driver\BulkWrite;
        $insertedId = $bulk->insert($document);
        $namespace = $this->db . '.' . $collection;
        $result = $this->client->executeBulkWrite($namespace, $bulk);
        return $insertedId;
    }

    // Helper method to update document
    public function updateOne($collection, $filter, $update, $options = []) {
        $bulk = new MongoDB\Driver\BulkWrite;
        $bulk->update($filter, $update, $options);
        $namespace = $this->db . '.' . $collection;
        $result = $this->client->executeBulkWrite($namespace, $bulk);
        return $result->getModifiedCount();
    }

    // Helper method to delete document
    public function deleteOne($collection, $filter) {
        $bulk = new MongoDB\Driver\BulkWrite;
        $bulk->delete($filter, ['limit' => 1]);
        $namespace = $this->db . '.' . $collection;
        $result = $this->client->executeBulkWrite($namespace, $bulk);
        return $result->getDeletedCount();
    }

    // Helper method to delete many documents
    public function deleteMany($collection, $filter) {
        $bulk = new MongoDB\Driver\BulkWrite;
        $bulk->delete($filter, ['limit' => 0]);
        $namespace = $this->db . '.' . $collection;
        $result = $this->client->executeBulkWrite($namespace, $bulk);
        return $result->getDeletedCount();
    }

    // Helper to convert MongoDB ObjectId from string
    public function createObjectId($id = null) {
        return $id ? new MongoDB\BSON\ObjectId($id) : new MongoDB\BSON\ObjectId();
    }
}

// Initialize database connection
try {
    $db = Database::getInstance();
} catch (Exception $e) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed',
        'message' => $e->getMessage()
    ]);
    exit();
}
