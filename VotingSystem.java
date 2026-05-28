import java.security.MessageDigest;
import java.util.*;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
/**
 * Core blockchain voting logic (in-memory, demo).
 * Later you can add persistence, PoW/PoS, stronger auth, etc.
 */
public class VotingSystem {
public static void saveVote(Block block) {
    try {
        Connection con = DatabaseConnection.getConnection();

        String sql = "INSERT INTO votes(voter_id, candidate, previous_hash, hash, timestamp) VALUES(?,?,?,?,?)";

        PreparedStatement ps = con.prepareStatement(sql);

        ps.setString(1, block.voterId);
        ps.setString(2, block.candidate);
        ps.setString(3, block.previousHash);
        ps.setString(4, block.hash);
        ps.setLong(5, block.timeStamp);

        ps.executeUpdate();

        con.close();

    } catch (Exception e) {
        e.printStackTrace();
    }
}


    static class Block {
        String voterId;
        String candidate;
        String previousHash;
        String hash;
        long timeStamp;

        Block(String voterId, String candidate, String previousHash) {
            this.voterId = voterId;
            this.candidate = candidate;
            this.previousHash = previousHash;
            this.timeStamp = System.currentTimeMillis();
            this.hash = calculateHash(voterId, candidate, previousHash, timeStamp);
        }

        static String calculateHash(String voterId, String candidate, String previousHash, long timeStamp) {
            return applySHA256(voterId + "|" + candidate + "|" + previousHash + "|" + timeStamp);
        }

        String calculateHash() {
            return calculateHash(voterId, candidate, previousHash, timeStamp);
        }

        static String applySHA256(String input) {
            try {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] hashBytes = md.digest(input.getBytes("UTF-8"));
                StringBuilder hexString = new StringBuilder();
                for (byte b : hashBytes) {
                    String hex = Integer.toHexString(0xff & b);
                    if (hex.length() == 1) hexString.append('0');
                    hexString.append(hex);
                }
                return hexString.toString();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
    }

    static final List<Block> blockchain = new ArrayList<>();
    static final Set<String> votedUsers = new HashSet<>();
    static final Map<String, Integer> results = new HashMap<>();
    static final List<String> candidates = new ArrayList<>();

    static int totalVotes = 0;

    public static synchronized void initCandidates() {
        if (!candidates.isEmpty()) return;
        candidates.add("A");
        candidates.add("B");
        candidates.add("C");
    }

    public static synchronized void createGenesisBlock() {
        if (!blockchain.isEmpty()) return;
        Block genesis = new Block("0", "GENESIS", "0");
        genesis.hash = "0"; // simple demo genesis marker
        blockchain.add(genesis);
    }

    private static synchronized void ensureAllCandidatesPresent() {
        for (String c : candidates) {
            results.putIfAbsent(c, 0);
        }
    }

    public static synchronized List<String> getCandidatesApi() {
        initCandidates();
        ensureAllCandidatesPresent();
        return new ArrayList<>(candidates);
    }

    public static synchronized boolean hasVoteApi(String voterId) {
        return votedUsers.contains(voterId);
    }

    public static synchronized String castVoteApi(String voterId, String candidate) {
        initCandidates();
        createGenesisBlock();
        ensureAllCandidatesPresent();

        if (voterId == null || voterId.trim().isEmpty()) return "Voter ID is required";
        if (candidate == null || !candidates.contains(candidate)) return "Invalid candidate";
        if (votedUsers.contains(voterId)) return "Voter has already voted";

        String prevHash = blockchain.get(blockchain.size() - 1).hash;
        Block newBlock = new Block(voterId, candidate, prevHash);
        blockchain.add(newBlock);
        saveVote(newBlock);
        votedUsers.add(voterId);
        results.put(candidate, results.getOrDefault(candidate, 0) + 1);
        totalVotes++;

        return "Vote recorded";
    }
    public static void loadBlockchainFromDatabase() {

    try {
        Connection con = DatabaseConnection.getConnection();

        String sql = "SELECT * FROM votes ORDER BY id ASC";

        PreparedStatement ps = con.prepareStatement(sql);

        ResultSet rs = ps.executeQuery();

        while (rs.next()) {

            Block block = new Block(
                    rs.getString("voter_id"),
                    rs.getString("candidate"),
                    rs.getString("previous_hash")
            );

            block.hash = rs.getString("hash");
            block.timeStamp = rs.getLong("timestamp");

            blockchain.add(block);

            votedUsers.add(block.voterId);

            results.put(
                    block.candidate,
                    results.getOrDefault(block.candidate, 0) + 1
            );

            totalVotes++;
        }

        con.close();

    } catch (Exception e) {
        e.printStackTrace();
    }
}

    public static synchronized Map<String, Integer> getResultsApi() {
        initCandidates();
        ensureAllCandidatesPresent();
        return new HashMap<>(results);
    }

    public static synchronized int getTotalVotesApi() {
        return totalVotes;
    }

    public static synchronized List<Block> getBlockchainApi() {
        return new ArrayList<>(blockchain);
    }

    public static synchronized boolean validateBlockchainApi() {
        // starting from index 1 because genesis is demo-marked
        for (int i = 1; i < blockchain.size(); i++) {
            Block current = blockchain.get(i);
            Block previous = blockchain.get(i - 1);

            if (!Objects.equals(current.previousHash, previous.hash)) return false;
            if (!Objects.equals(current.hash, current.calculateHash())) return false;
        }
        return true;
    }

    // Demo endpoint: intentionally breaks chain (useful to test validation)
    public static synchronized void tamperBlock() {
        if (blockchain.size() <= 1) return;
        blockchain.get(1).candidate = "HACKED";
    }
}

